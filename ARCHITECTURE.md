# ClickCount — Code Map for AI Navigation

Use this file to locate code in the app. The HTML shell + every modal live in
[app/index.html](app/index.html) (~2.4k lines, served at `/app/`; the repo-root
[index.html](index.html) is the static marketing landing); the bulk of the app
logic (the main JS
IIFE) lives in [app.js](app.js) (~6.5k lines, slimmed from ~16.2k as the pure
modules + the `window.App` feature-file splits were pulled out). The core data
model and invariants live in [RECONSTITUTE.md](RECONSTITUTE.md); this file is the
navigation map plus the catalog of features built on top of that core.
Implementation history (the sync-hardening work + the modularization arc) lives in
[CHANGELOG.md](CHANGELOG.md).

> Navigation philosophy: **do not rely on line numbers** — [app.js](app.js)
> is ~6.5k lines and edits shift them constantly. Navigate by the `// SECTION:`
> markers in the code and by the grep patterns in the Search Hints table below.

## Large-file map (decomposition status)

Current first-party line counts (`wc -l`, 2026-09-02 — the **numbers and this
date are GENERATED** by `npm run build:filemap`
([scripts/build-filemap.js](scripts/build-filemap.js)); `npm run check` fails
when they drift, so don't edit counts by hand. Which files are listed and every
Status / verdict stay human-written — add a row and the generator keeps its
count fresh. Excludes `vendor/`, `node_modules/`, generated files, and
tests/specs). Use this table to decide where the next decomposition effort pays
off — and where it doesn't.

| File | Lines | Status / verdict |
|------|------:|------------------|
| [app.js](app.js) | 7,505 | **The remaining monolith** — down from 16.2k (9.9k after save-engine Stage 6, 8.1k after the Tier-2 splits, then −987 from the canvas-draw extraction). The only file worth actively shrinking; the region table below says what's left and in what order. |
| [save-engine.js](save-engine.js) | 3,000 | Done — the extracted save/sync seam module (Stages 1–6), 44 node tests. Large but modular and fully node-testable; no further action. |
| [pdf-tile-cache.js](pdf-tile-cache.js) | 867 | Done (stage 1, 2026-07-30) — the PDF raster-cache substrate extracted from app.js's "PDF render bitmap cache" section (`createPdfTileCache(ctx)`, the save-engine seam recipe): page-bitmap LRU, downsample pyramid, persisted zoom rungs, idle prefetch, full-document warm-up. Pinned by nine Playwright specs (page-switch-cache, pyramid, pyramid-persist, rung-prefetch, doc-warmup, zoom-ladder, commit-tile, crop-tile, tile-grid). Stage 2 (later): the Sharp crop tile / tile grid section. |
| [canvas-draw.js](canvas-draw.js) | 1,019 | Done — the unified annotation draw core (`createCanvasDraw(deps)` + `drawAnnotationsCore`), node-tested, guarded by [render-pixels.spec.js](render-pixels.spec.js). Both draw paths are thin env-builders over it. |
| [app/index.html](app/index.html) | 2,852 | The shell: HTML structure + every modal, no inline JS. Flat markup with no build step to split it; grows roughly linearly with modal count. Leave. |
| [styles.css](styles.css) | 1,866 | All CSS, token-organized. Leave. |
| [features/load-project.js](features/load-project.js) | 717 | Largest feature file (Load Project modal + filters), split 2026-07-30: the copy/fork domain moved to [features/copy-project.js](features/copy-project.js) at the file's documented domain boundary, and the row renderer was decomposed along its action boundaries (size / row HTML / actions / admin access / load click). Healthy — leave. |
| [annotation-model.js](annotation-model.js) | 850 | Done — extracted canvas/annotation data model + node tests. |
| [undo-stack.js](undo-stack.js) | 160 | Done (2026-07-30) — `createUndoStack(ctx)` split out of annotation-model.js: the model is pure-ish data transformation, the stack is a command-history controller with UI side-effect hooks in its ctx. Covered by the undo tests in [annotation-model.test.js](annotation-model.test.js) (interleaved with model tests, dual-require). |
| [icons.js](icons.js) | 531 | Bundled icon data, mostly literals. Leave. |
| [report.js](report.js) | 611 | Self-contained report builder with a frozen `window.*` contract. Leave. |
| `features/*.js` (69 files) | 16,902 total | Healthy: largest after load-project are quick-modals (462), user-activity (459), user-admin (453), room-sizer (443), output (416), scale (412) — each single-feature scoped with its own Playwright spec. Leave. |

### What's left inside app.js (by `// SECTION:` size)

The regions below account for a large share of the ~6.5k lines; every other section is
already <300 lines — wiring, boot, and thin wrappers over the extracted
modules. Candidates in priority order:

| Region | Lines | Assessment |
|--------|------:|------------|
| PDF render bitmap cache | ~35 | **DONE (2026-07-30)** — was ~478. The whole substrate (page-bitmap LRU, downsample pyramid, persisted zoom rungs, idle prefetch, full-document warm-up walk) moved to [pdf-tile-cache.js](pdf-tile-cache.js) (`createPdfTileCache(ctx)`, stage 1). What remains under the marker is the instantiation, the ctx (13 live-value accessors), and same-named thin wrappers. The Sharp crop tile / tile grid section is the pre-identified stage 2. |
| PDF Rendering | ~589 | **DONE (2026-07-20)** — was ~1,576. The duplicated draw logic (`renderAnnotations` live / `renderAnnotationsToContext` export) was unified into [canvas-draw.js](canvas-draw.js)'s `drawAnnotationsCore(ctx, ann, env)`; both callers are now thin env-builders, and `drawDropMarker`/`drawRoomBoxesToContext`/`drawLegend`/`drawGrid`/`hexToRgb`/`lineStyleToDash` moved with it. What remains here is `renderPdf` (the pdf.js raster + bitmap-cache blit), the live-only scale-reference UI, and the in-progress rubber-band previews — all genuinely live-path code. Guarded by [render-pixels.spec.js](render-pixels.spec.js) (pixel baselines) + [canvas-draw.test.js](canvas-draw.test.js). |
| UI Render Functions | ~545 | Second candidate — **decomposition started 2026-07-24**: `renderLinesList` (123 lines) moved to [features/lines-list.js](features/lines-list.js), proving the per-list recipe (defensive updateUI seam, five publish-only deps, zero moved state). Continued 2026-07-30: `renderPagesList` (+`formatPageTitleStartEnd`) → [features/pages-list.js](features/pages-list.js); `renderCountersList`/`renderLineTypesList`/`renderGroupsList`/`countItemsInGroup` (+`quickKeyBadgeHtml`) → [features/sidebar-lists.js](features/sidebar-lists.js); `renderCanvasSwitcher` → [features/canvas-switcher.js](features/canvas-switcher.js) and `renderSummary` → [features/summary-list.js](features/summary-list.js) (same recipe, zero new deps). Remaining: `updateUI` (~470 lines, stays core). |
| Canvas mouse, wheel & touch handlers + Canvas Event Handlers + Aim loupe | ~1,160 combined | The input layer — the most state-entangled code in the file (drag state, tool modes, gesture arbitration) with the lowest unit-test leverage. Extract **last**, if ever, as an input-controller seam module. |
| Math & Format Helpers | ~405 | Mostly *already* thin wrappers over geometry/line-metrics/annotation-model — the status/footer-totals cluster that was misfiled here moved to [features/status-bar.js](features/status-bar.js) 2026-07-30. Low yield — mine stray pure helpers (`getNoteRotationRad`, `formatSaveTime*`) into format.js/geometry.js opportunistically; don't force it. |
| The `[sync]` sections (Turn In, recovery wiring, local backup, …) | ~750 combined | Modal/UX wiring over the save-engine seam — the engine owns the logic. The checkout-lifecycle UX (the one stretch that was real code) moved to [features/turn-in.js](features/turn-in.js) 2026-07-30; what remains is wiring. Leave. |

## Files

| File | Purpose |
|------|---------|
| [app/index.html](app/index.html) | The app shell, served at `/app/`: HTML structure + every modal; `<head>` loads the CSS/config/module scripts via root-absolute refs, the body ends by loading `app.js`, the `features/*.js` splits, then `report.js`. No inline JS logic (~2.4k lines). Includes `#toastRegion` — the four toast surfaces (`#setScaleFirstModal`, `#outOfBoundsModal`, `#pipeToolingCopiedModal`, `#airboardToastModal`) are **non-blocking corner cards** at z-index 350 (above every modal, `pointer-events:none` on the region; `.toast-interactive` is the per-card opt-in for cards that carry a real control — `#setScaleFirstModal` uses it: its "Set Scale ⚖" words are a real button `#setScaleFirstLink` opening the Set Scale dialog, Tier-2 #23), plus `#turnInProgressModal`, turn-in's own deliberate blocking overlay (Tier-2 #15). Regression: [toast-region.spec.js](toast-region.spec.js) |
| [toast-region.spec.js](toast-region.spec.js) | Playwright regression owning the toast-system contract (Tier-2 #15) — a live toast blocks nothing (canvas hit-testing + a real counter click land during the toast), toasts paint above open modals (paint-order proved through the `.toast-interactive` opt-in, since `elementFromPoint` skips `pointer-events:none` nodes), two simultaneous toasts flex-stack without overlap and dismiss on their own timers, the pointer-events contract (region `none`, cards inherit, `.toast-interactive` computes `auto` — the T2-06 hook), and Escape is never consumed by a toast (one press closes the open modal; the toast still self-dismisses). `npx playwright test toast-region.spec.js` |
| [index.html](index.html) | The **static marketing landing** at `/` — plain HTML sharing `marketing.css`, no app JS, outside the SW scope; forwards old `/?t=`/`?devAuth=1` links to `/app/` |
| [app.js](app.js) | The bulk of the app logic — the former inline `index.html` IIFE, extracted into a classic `<script src>` (`(function() { … })();`, ~6.5k lines, slimmed from ~16.2k as the pure modules + `window.App` feature files were pulled out). Resolves the sibling modules' values by bare name (including the [idb.js](idb.js) storage primitives); exposes its own helpers to `report.js` via `window.*` at the IIFE tail. Linted (`no-undef` as error, the rest of the recommended set as warnings) |
| [styles.css](styles.css) | All CSS (design tokens, layout, modals, sidebar, mobile); linked from `<head>` |
| [icons.js](icons.js) | Bundled icon data — `*_PATH` consts, `VB_384_512_PATHS`, `FA_PATHS`, `RING_PATH`, `CUSTOM_ICONS`, `ICONS`; classic `<script src>` loaded before app.js; values resolve in the shared global lexical scope; guarded CommonJS export footer (`ICONS`, `CUSTOM_ICONS`, `VB_384_512_PATHS`, `FA_PATHS`, `RING_PATH`, `CIRCLE_PATH`, `SCALE_CROSSHAIR_PATH`) so `eslint.config.js` can derive the app.js lint globals **CUSTOM_ICONS moved out** to [icons-custom.js](icons-custom.js) (generated; loads right after this file) |
| [icons-custom.js](icons-custom.js) | **The GENERATED bundled custom-icon data** — the `CUSTOM_ICONS` array (79KB, `{value, viewBox, name}` literals sourced from `my-counters/*.svg`). `npm run build:icons` ([scripts/build-custom-icons.js](scripts/build-custom-icons.js)) overwrites the file wholesale — no more paste-into-icons.js step, and regenerations stop churning the 246KB icons.js. Classic `<script src>` loaded between [icons.js](icons.js) and [icon-render.js](icon-render.js) (which builds `CUSTOM_ICON_META` from `CUSTOM_ICONS` at parse time — the load-order constraint). Guarded CommonJS footer for the Node tests + the eslint derived-globals wiring |
| [geometry.js](geometry.js) | Pure math/geometry/parse primitives — `ptDist`, `polylineDistance`, `polygonArea`, `distToSegment`, the quadratic-bezier helpers, `rotatePoint90CW`, `pointInRect`, `rectsOverlap`, `clampMenuPosition` (the popover viewport clamp behind `App.placeFixedMenu`), the zone locators (`getMultiplyZoneForPoint/Line`, `getScaleZoneForLine`) + `counterTally` (T2-11: `{ placed, withRepeats }` for one annotations object — the one counter arithmetic behind every badge/rollup surface), `formatLineLengthRealSum`, `parseRealWorldLength`, `parseFraction`, `formatAgo`, `formatFeetInchesFromVal`; classic `<script src>` loaded before the IIFE; no `state` dependency; has a guarded CommonJS export footer (`if (typeof module !== 'undefined' …)`, inert in the browser) so the primitives can be `require()`d by [geometry.test.js](geometry.test.js) |
| [constants.js](constants.js) | Pure module-level constant literals — `TOOL`, `SCALE_MODES`, `PLUMBING_DEFAULTS`, `LINE_DEFAULTS`, `COLORS`, `SCALE_PRESETS`, the autosave/checkout timing & threshold block, IndexedDB store names + caps, Save Status log windows, checkout messages, and assorted keys/URLs/TZ (the recent-color helpers `nextRecentColors` + `RECENT_COLORS_MAX` live in the sibling [recent-colors.js](recent-colors.js), split out 2026-07-30 — behavior, not literals); classic `<script src>` loaded before the IIFE; no `state`/`window`/icon dependency (env reads like `SUPABASE_*`/`BACKUP_PDF_TO_INDEXEDDB`/`IS_DEV_HOST`, icon-derived consts, and function-local consts stay in app.js); guarded CommonJS export footer so the values can be `require()`d by [constants.test.js](constants.test.js) |
| [geometry.test.js](geometry.test.js) | Node `node:test` + `node:assert` unit tests for the [geometry.js](geometry.js) primitives (including the T2-11 `counterTally` placed/with-repeats cases); run with `npm run test:unit` (no deps). Naming split: `*.test.js` = Node unit tests, `*.spec.js` = Playwright (see `testMatch` in [playwright.config.js](playwright.config.js)) |
| [menu-clamp.spec.js](menu-clamp.spec.js) | Playwright regression for popover viewport clamping (`App.placeFixedMenu` → the pure `clampMenuPosition`) — on a short viewport, a REAL right-click on a quick line seeded ~20 CSS px above the canvas bottom opens `#contextMenu` fully on-screen (pulled up above the pointer, `#ctxTargetNameRow` intact — the field-reported off-screen-Delete case), and the footer Copy-to-/Tooling drop-up opens with measured height inside the viewport. `npx playwright test menu-clamp.spec.js` |
| [constants.test.js](constants.test.js) | Node `node:test` invariant tests for [constants.js](constants.js) (backoff arrays increasing & positive, timings/caps > 0, unique enum ids, valid hex colors, positive scale presets); run with `npm run test:unit` |
| [report.js](report.js) | Loads after app.js. Print report, Summary, `getPipeToolingSummary(options)`, `getEmailTextSummary(options)` (both accept `{ pageIndices, getAnnotations }`); `escapeHtml`; consumes globals exposed by app.js via `window.*`. Its `window.*` attachment is guarded by `typeof window` and it has a guarded CommonJS export footer (`escapeHtml`, `pickScaleForLineType`) — both inert in the browser — so those pure helpers can be `require()`d by [report.test.js](report.test.js) |
| [report.test.js](report.test.js) | Node `node:test` unit tests for [report.js](report.js)'s pure helpers — `escapeHtml` (null/undefined → `''`, entity escaping, `&`-first ordering, `String()` coercion) and `pickScaleForLineType` (preferred-unit selection via a `global.state` stub); run with `npm run test:unit` |
| [save-utils.js](save-utils.js) | Pure helpers for the save/sync layer — `isTransientSaveError` (which save/turn-in errors merit one retry), `getProjectCounts` (counter/line totals over a project `data` object, both legacy `annotations` and `canvases` shapes), plus the pure-mined set: `serializeSaveError` (the **deduped** error serializer that replaced app.js's near-identical `serializeSaveErrorForEvent` + `saveDebugSerializeError`), `formatSaveStatusErrDetail`, `backoffDelayMs` (auto-save backoff level for a failure count), `computeClockOffsetMs` (server/local skew from an RPC `server_now`), and `percentile` (p95 of latency samples). Classic `<script src>` loaded before the IIFE; no `state`/DOM dependency — app.js keeps the state-coupled callers (`updateServerClockFromRpc`, the backoff line, `recordAutosaveLatency`) that delegate to these. Guarded CommonJS export footer so the helpers can be `require()`d by [save-utils.test.js](save-utils.test.js) |
| [save-utils.test.js](save-utils.test.js) | Node `node:test` unit tests for [save-utils.js](save-utils.js) (the `isTransientSaveError` transient/non-transient matrix ported from the old localhost `console.assert` block, `getProjectCounts` shape/sum cases, plus the pure-mined helpers: `serializeSaveError` fields/null/`String(e)` fallback, `formatSaveStatusErrDetail`, `backoffDelayMs` clamp, `computeClockOffsetMs` string/numeric/null, and `percentile` p95/empty); run with `npm run test:unit` |
| [annotation-model.js](annotation-model.js) | **The canvas/annotation data model** (Tier-2 item 7) — exports `createAnnotationModel(ctx)` + `createUndoStack(ctx)`, the same seam recipe as the save engine. Classic `<script src>` loaded after [geometry.js](geometry.js) + [icons.js](icons.js) (reads `bakeFramesMatch`/`rotatePoint90CW`/`pointInRect`/`CIRCLE_PATH` by bare name) and before [save-engine.js](save-engine.js); app.js instantiates both once and keeps same-named thin wrappers so call sites, the App registry, and the feature-file contracts stay frozen. The model owns: `makeAnnotations` (the canonical shape), canvas-layer accessors (`getPageCanvases`/`getActiveCanvas`/`getActiveAnnotations`/`ensureActiveCanvas`/`getMergedAnnotationsForPage`/`mergeAnnotations`/`migratePageToCanvases`), has-any checks, backup↔proj format conversion, bake-frame stamp/verify, the backup/data appliers (`applyTakeoffBackupToState`/`applyPageAnnotationsFromData`), orphan reconcile, the **rect-select operations** (`countItemsInRect`, `collectItemsToDeleteInRect`, `deleteCollectedItems` — the Delete Area splice core with its load-bearing descending-index order; app.js's `performDeleteZone` keeps the undo/dirty/re-render choreography, ctx supplies `getLineRealWorldLengthFeet`), the **page-rotation math** (`rotateAnnotations`/`applyRotationDeltaToAnnotations` — node-tested 4×90° round trips), and `deepCopyAnnotations`. `createUndoStack` owns the undo/redo snapshot stacks (pages/counters/lineTypes/groups/rooms). Guarded CommonJS footer so [annotation-model.test.js](annotation-model.test.js) can `require()` it |
| [undo-stack.js](undo-stack.js) | **The undo/redo stack** (`createUndoStack(ctx)`) — split out of [annotation-model.js](annotation-model.js) 2026-07-30 (two unrelated factories shared the file). Full-project snapshots (`pushUndoSnapshot`) plus the O(current-page) `pushUndoSnapshotPage` fast path for high-frequency placements; `applySnapshot` branches on `snap.scope`, and the shared tail clears in-flight gesture state and dangling active ids. ctx carries `getState`/`uid`/`ensureGroupColors` plus the three UI side-effect hooks (`markProjectDirty`, `renderPdf`, `updateUI`) that undo()/redo() invoke — the reason it is a separate concern from the model. Reads `UNDO_STACK_SIZE` (constants.js) by bare name. app.js instantiates it as `undoStackModel` with same-named thin wrappers. Tests: the undo suite in [annotation-model.test.js](annotation-model.test.js) (dual-require). |
| [save-engine.js](save-engine.js) | **The save/sync engine module** (staged extraction; Stages 1–4 landed) — exports `createSaveEngine(ctx)`. Classic `<script src>` loaded after [constants.js](constants.js) + [save-utils.js](save-utils.js) (reads their exports by bare name — `GLOBAL_RELOAD_*`/`CHECKOUT_*`/`SAVE_STATUS_LOG_*` constants, `serializeSaveError`) and before [app.js](app.js), which instantiates it once near the top of its IIFE with a **ctx of accessors/callbacks** whose live contract is documented in the file header and grows per stage — arrows that resolve live values at call time, so client recycles and `let` reassignments are always seen. app.js keeps **same-named thin wrappers** so call sites, the App registry, and `window.*` contracts stay frozen as clusters migrate behind the seam. **Stage 1:** the `[sync] Global force reload` cluster (check + reload + the pending-stamp commit listener installed via `installGlobalReloadStampCommit()` + banner) and the `[sync] Checkout keep-alive` probe. **Stage 4 (client resilience):** `noteSupabaseJsFailure` + the wedge stamp, `runRecoveryProbe` (raw-fetch connection probe), `runSupabaseClientProbe`, `recreateSupabaseClient` (reassigns the app-side client via `ctx.setSupabase`; re-subscribes via `ctx.resubscribeCheckout`), the two orchestrators (`runRecoveryProbeAndMaybeRecycle`, `recycleClientIfWedgedOnIdleReturn`), and the four raw-fetch fallbacks (`rawProjectsUpdate`/`rawProjectsInsert`/`rawCheckInProject`/`rawListAccessibleProjects`) — with engine-owned in-flight guards, the recycle cooldown/count, and getters (`getLastSupabaseJsFailureAt`/`getClientRecycleCount`/`isClientRecycleInFlight`) for the app-side turn-in/save/envelope readers. **Stage 3 (storage ring):** `probeCheckoutLock` (graduated from ctx to engine-internal), `sha256Hex`, the `takeoffBackupGet`/`takeoffBackupPut` mismatch/warn wrappers, and the three-layer local-backup writer (`writeTakeoffStateBackup` → `writeTakeoffBackupToIndexedDB` → the serializer) with engine-owned `takeoffBackupWriteInFlight`/`takeoffBackupWarnShown`/`lastLocalBackupAt`/`lastLocalBackupOk` + the 1s dirty→backup debounce (also graduated from ctx); the 5s interval + visibilitychange kick stay app-side calling wrappers. **Stage 2 (the engine's first owned state):** the Save Status **log core** (the `saveStatusLog` array + `pushSaveEvent`/`pruneSaveStatusLog`/window + the `[SaveDebug]` helpers; `App.getSaveStatusLog` delegates to the engine getter) and the **dirty core** (`markProjectDirty` + engine-owned `dirtyGeneration`/`dirtyStartedAt` with `getDirtyGeneration`/`getDirtyStartedAt`/`clearDirtyStartedAt`/`resetDirtyTracking` for the app-side save paths; `autoSaveDirty`/`lastModifiedAt` stay app-side via ctx get/set until their primary writers migrate; the debounced backup kick stays app-side as `ctx.scheduleTakeoffBackup`). Guarded CommonJS footer so [save-engine.test.js](save-engine.test.js) can `require()` it |
| [pdf-tile-cache.js](pdf-tile-cache.js) | **The PDF raster-cache substrate** (`createPdfTileCache(ctx)` — the save-engine seam recipe, stage 1 of the pdf-tile-cache extraction): the page-bitmap LRU (self-validating key: pdfPage proxy + rotation + zoom + effDpr; per-entry and whole-cache pixel budgets), the downsample pyramid (derive-from-original, one level per macrotask), the cross-session persisted zoom rungs (webp blobs in IndexedDB keyed by doc content hash), the idle neighbor/rung prefetcher (momentum-biased, one-attempt-per-chain), and the full-document warm-up walk (marked pages first, then the outward spiral; `#statusWarmup` progress). Instantiated once in app.js with a 13-entry ctx of live-value accessors (`renderAreaSafety`, `pdfRenderTask`, `lastPaintedPdfPage`, `zoomGestureDirection`, `renderService` all resolve at call time); app.js keeps same-named thin wrappers plus a shared-reference `pdfBitmapCacheStats` alias (renderPdf increments `.hits`/`.misses` in place). Reads `snapZoomToRung`/`nextRungUp`/`nextRungDown`/`ZOOM_RUNGS_MAX_PER_DOC` (constants.js) and `idbZoomRung*` (idb.js) as bare classic-script globals. The App debug seams (`__pdfBitmapCacheStats`/`Keys`/`Dump`, `__docWarmupState`) delegate to its `debug*`/`warmupState` members — shapes frozen (specs). The Sharp crop tile / tile grid stays in app.js for stage 2. Guarded by the nine cache/zoom/warm-up specs. |
| [save-engine.test.js](save-engine.test.js) | Node `node:test` unit tests for [save-engine.js](save-engine.js) — `createSaveEngine` with a fully stubbed ctx + stubbed idb primitives (21 tests). Stage 1: the keep-alive skip ladder / expiry routing / contained recovery throw (asserted against the engine's own log) and the force-reload decision matrix. Stage 2: log push/get/clear round-trip + disabled-Supabase drop, verbose-mode window widening + `saveDebugLog` gating, and `markProjectDirty` semantics (viewer/empty no-ops, generation bump, first-dirty stamped once, backup kick, 2s dirty-event throttle, holder-only checkout refresh + debounce, `resetDirtyTracking`). Stage 3: the backup writer (viewer/empty no-ops; local-key serialization + success stamps; the debounced markProjectDirty→backup landing in the idb stub), takeoffBackupGet cross-user delete-and-hide, and probeCheckoutLock (non-holder expired; healthy refresh stamping clocks). Stage 4: noteSupabaseJsFailure filtering, the recycle happy-path/cooldown (client swap + resubscribe + count), the orchestrator's zero-failures early exit, and the raw-insert no-token shape. Constants + save-utils exports come via `Object.assign(globalThis, require(...))` per the line-metrics pattern; run with `npm run test:unit` |
| [idb.js](idb.js) | IndexedDB storage layer extracted from app.js — the single `openPdfCacheDb` (one DB `clickcount-pdf-cache` v7, 10 stores) plus the context-free accessors `viewCache*`, `pdfCache*` (LRU), `takeoffBackupDelete`, `readSaveLogsSnapshots`, the resumable-upload URL store accessors `idbPdfUploadResume*` (get-all / get-by-fingerprint / put / delete / delete-by-fingerprint — backs tus's `UrlStorage` for cross-reload resume of large PDF uploads), and the pure primitives `idbTakeoffBackupGetRaw`, `idbTakeoffBackupPut` (eviction + stale-skip, returns a status), `idbPutSaveLogsSnapshot` (put + prune), `idbCustomIconsGet`/`idbCustomIconsPut`. Classic `<script src>` loaded after [constants.js](constants.js) (whose store-name/cap globals it reads by bare name) and before [app.js](app.js). Depends only on constants + `indexedDB` + args — no `state`/loggers; the state/logging concerns stay in app.js as same-named thin wrappers (`takeoffBackupGet`, `takeoffBackupPut`, `writeSaveLogsSnapshot`, `customIconsGetFromIndexedDB`/`customIconsPutToIndexedDB`). Guarded CommonJS export footer so the primitives can be `require()`d by [idb.test.js](idb.test.js) |
| [idb.test.js](idb.test.js) | Node `node:test` unit tests for [idb.js](idb.js) using `fake-indexeddb` (a fresh `IDBFactory` per test) — pdf-cache hash-mismatch + byte-cap LRU eviction, takeoff-backup round-trip + stale-skip + delete, custom-icon legacy→per-user migration, and save-logs-snapshot prune/newest-first ordering; run with `npm run test:unit` |
| [format.js](format.js) | Pure date/time/text formatters extracted from app.js — `wrapNoteTextCore` (the note word-wrap core with hyphen/underscore break opportunities; app.js's `wrapNoteText` wrapper supplies the canvas-backed measurer, tests stub it), `escapeHtml` (THE canonical HTML escaper, `& < > " '` superset; app.js reads it by bare name and publishes `App.escapeHtml` for feature files, replacing what were 27 inline copies in four behavioral variants — some skipped the quote entities), `formatLastSignIn`, `dateKeyInTimeZone`, `calendarDaysFromSignInToNowInZone`, `formatLastSignInUserActivity`, `formatUserActivityDateTime`, `filterUserActivityRows`, `renderUserActivityAllUsersTableHtml`. Classic `<script src>` loaded after [constants.js](constants.js) (reads `USER_ACTIVITY_TZ` by bare name) and before [app.js](app.js); no `state`/DOM dependency (the DOM-coupled User Activity modal code — `applyUserActivityFilter`, `populateUserActivityUserSelect` — stays in app.js). Guarded CommonJS export footer so the formatters can be `require()`d by [format.test.js](format.test.js) |
| [format.test.js](format.test.js) | Node `node:test` unit tests for [format.js](format.js) — `calendarDaysFromSignInToNowInZone` integer deltas (incl. year boundary / future), `filterUserActivityRows` match/case rules, `renderUserActivityAllUsersTableHtml` cells + escaping, `formatLastSignIn` relative buckets, `formatUserActivityDateTime`; the two en-CA-hyphen-dependent cases (`dateKeyInTimeZone`, `formatLastSignInUserActivity` Today) auto-skip on a limited-ICU runtime and run on full-ICU (browser-equivalent / CI Node 20); run with `npm run test:unit` |
| [icon-render.js](icon-render.js) | Pure icon geometry / render-rule helpers extracted from app.js — the `CUSTOM_ICON_META` table (derived from `CUSTOM_ICONS`) plus `iconMetaFromList`, `iconViewBoxFromList`, `iconRenderVbRule`, `iconRenderCenterRule`, `iconViewBoxStringRule`, `iconSvgHtml`, and the shared picker-grid cell builders `iconCellHtml` / `iconGridCellsHtml` / `customIconCellsHtml` (+ `ICON_UPLOAD_CELL_HTML`) that replaced the cell markup copy-pasted across counter.js / item-details.js / quick-modals.js / custom-icon-upload.js (published on `App` as `iconGridCellsHtml` / `customIconCellsHtml`; each picker keeps its own click wiring). Classic `<script src>` loaded after [icons.js](icons.js) (reads `CUSTOM_ICONS`/`VB_384_512_PATHS`/`FA_PATHS` by bare name; the top-level `CUSTOM_ICON_META` read is `typeof`-guarded so Node `require` stays load-safe) and before [app.js](app.js). Depends only on icons.js globals + args — no `state`/DOM/user-icon-cache. app.js keeps the cache-coupled lookups (`getCustomIconMeta`, `getCustomIconViewBox`, `iconRenderVb`, `iconRenderCenter`, `iconViewBoxString`, `renderIconHtml`) as same-named thin wrappers that inject `getEffectiveCustomIcons()`. Guarded CommonJS export footer so the primitives can be `require()`d by [icon-render.test.js](icon-render.test.js) |
| [icon-render.test.js](icon-render.test.js) | Node `node:test` unit tests for [icon-render.js](icon-render.js) — `CUSTOM_ICON_META` derivation, `iconMetaFromList` (built-in fast path / injected user-icon parse / unknown→null), `iconViewBoxFromList`, the three rule functions across an `FA_PATHS` member / a `VB_384_512_PATHS` member / a default path, and `iconSvgHtml` markup + default color; run with `npm run test:unit` |
| [line-metrics.js](line-metrics.js) | Pure line-length / scale math extracted from app.js — `lineSegmentLength` (arc-aware chord), `lineGeomPdfPts`, `lineLengthPdfPts` (adds drop length), `effectiveScaleForLine` (scale-zone override vs page scale), `lineRealWorldLength`, `lineLengthForTotals` (× multiply-zone factor), `lineLengthFeetForTotals` (the same total converted to feet, for the always-feet tallies), `scaleForLineType` (unit-preference pick across pages). Classic `<script src>` loaded after [geometry.js](geometry.js) (reads `ptDist`/`polylineDistance`/the bezier helpers/`getScaleZoneForLine`/`getMultiplyZoneForLine` by bare name) and before [app.js](app.js). Depends only on geometry.js globals + args — no `state`. app.js keeps the state-coupled, report.js-facing API (`quickLineLength`, `getLineLengthPdfPts`, `getEffectiveScaleForLine`, `getLineRealWorldLength`, `getLineLengthForTotals`, `pickScaleForLineType`) as same-named thin wrappers that resolve the per-page scale / line-type / pages from `state` and keep their `window.*` exports; the module's function names are deliberately distinct from the wrappers so the app.js-derived globals don't trip `no-redeclare`. Guarded CommonJS export footer so the primitives can be `require()`d by [line-metrics.test.js](line-metrics.test.js) |
| [line-metrics.test.js](line-metrics.test.js) | Node `node:test` unit tests for [line-metrics.js](line-metrics.js) — straight vs arc segment length, polyline summation, drop-length addition (only when scaled), scale-zone override in `effectiveScaleForLine`, real-world length with/without drops, the multiply-zone factor in `lineLengthForTotals`, and `scaleForLineType` unit preference / fallbacks. Sets up the geometry globals via `Object.assign(globalThis, require('./geometry.js'))` before requiring the module; run with `npm run test:unit` |
| [canvas-draw.js](canvas-draw.js) | **The unified annotation draw core** — exports `createCanvasDraw(deps)` (the save-engine seam recipe) plus the pure `drawDropMarker` / `hexToRgb` / `lineStyleToDash` (read by app.js by bare name). Classic `<script src>` loaded after [geometry.js](geometry.js) + [icons.js](icons.js) (reads `roomBoxDimsFeet`/`formatFeetInchesFromVal`/`ptDist`/the bezier helpers/`getMultiplyZoneForPoint`/`formatFeet`/`RING_PATH`/`CIRCLE_PATH` by bare name) and before [app.js](app.js), which instantiates it once with live-value accessor arrows (`getState`, `getEffectiveScaleForLine`, `getLineRealWorldLength`, `formatDistFeetInchesFromReal`, `getGroupColor`, `wrapNoteText`, `getNoteRotationRad`, `iconRenderVb/Center`, `getPageScale`, `getLineLengthFeetForTotals`). The factory owns: `drawAnnotationsCore(ctx, ann, env)` — the ONE painter for every persisted mark kind (quickLines → polylines → highlights → multiplyZones → scaleZones → roomBoxes → notes → counterMarkers), where `env` is the **divergence register** between the live overlay and the export path (transform, line width, font scale, label pad, dot radius, counter sizes, font family, selection glow, note handles — itemized in the file header); plus `drawRoomBoxesToContext`, `drawLegend`, and `drawGrid`. app.js's `renderAnnotations` (live: zoom·DPR env + selection + handles) and `renderAnnotationsToContext` (export: scale env, frozen 5-arg signature consumed by export-pdfs/output/pdf-bundle/summary-detail) are now thin env-builders over the core — a new mark kind is drawn **once**. Deliberately preserved quirks are commented in place (export labels use `sans-serif` vs live `DM Sans`; counter index numbers are `DM Sans` in both; zone chrome does not scale on export). Guarded CommonJS footer so [canvas-draw.test.js](canvas-draw.test.js) can `require()` it |
| [render-service.js](render-service.js) | **The raster seam** (option 4) — exports `createRenderService(deps)`; every pdf.js raster (renderPdf's full-page pass, the idle bitmap prefetcher, the crop tile) flows through `renderService.raster({pdfPage, scale, rotation, offsetX, offsetY, canvasContext, kind})`, which returns the pdf.js RenderTask shape (`{promise, cancel}`, `RenderingCancelledException` on cancel) so callers' cancel/pending machinery is untouched. Two backends: MAIN (pdfPage.render, always available) and WORKER ([render-worker.js](render-worker.js)) — chosen automatically. Document adoption is LAZY and site-free: the first worker-eligible raster reads the doc bytes back via `pdfPage._transport.getData()` (a private field of the version-pinned pdf.js 3.11.174 — guarded; any shape change just disables the worker) and ships them to the worker; new documents re-adopt by transport identity with generation guards. Gates: Worker+OffscreenCanvas support, the `window.DISABLE_RENDER_WORKER` config escape hatch, a deviceMemory×doc-size cap; ANY worker failure falls back to main for the session, logs `render_worker_fallback` to the Save Status log, and fires the optional `deps.onFallback(reason)` — app.js mirrors it into the admin activity feed via `logUserEvent`, so a silently-degraded session is admin-visible without a user-exported log. Debug/spec hooks on App: `__renderServiceStats` (incl. a per-request kind+page log — the spec-side replacement for wrapping `pdfPage.render`), `__renderServiceMode`, `__renderWorkerState`, `__setRasterTestDelay`. Guarded CommonJS footer for [render-service.test.js](render-service.test.js) |
| [render-service.test.js](render-service.test.js) | Node `node:test` unit tests for the seam's main backend + contract (5 tests): param forwarding into `getViewport`/`render`, stats/log accounting, cancel parity (`RenderingCancelledException`, inner-task cancel), cancel-during-test-delay never starts the raster, per-kind test-delay filtering, and non-cancel error propagation; run with `npm run test:unit` |
| [render-worker.js](render-worker.js) | **The dedicated pdf.js render worker** — its own pdf.js instance (same-origin importScripts of the vendored lib; an explicit nested `GlobalWorkerOptions.workerPort` bypasses pdf.js's no-`window`⇒Node fake-worker detection, which needs `document` and dies in worker scope) over its own copy of the document bytes; rasters pages (with crop offsets for the tile) into OffscreenCanvas and posts back transferable ImageBitmaps. `getDocument` gets three worker-scope shims for pdf.js defaults that lazily reach for `document`: a duck-typed **OffscreenCanvas canvasFactory** (aux canvases for tiling patterns / transparency groups / soft masks — routine on hatched CAD sheets; without it the first such raster threw "createElement of undefined" and wedged the session into main fallback), a **no-op filterFactory**, and an **`ownerDocument: {fonts: self.fonts}` shim** so FontLoader installs embedded fonts into the worker's own FontFaceSet (without it every glyph rasters as a black box; engines lacking `self.fonts` get `disableFontFace` glyph-outline drawing instead), and an explicit **`useWorkerFetch: true`** (with `cMapUrl`/`standardFontDataUrl` set but useWorkerFetch unset, pdf.js computes the default by touching `document.baseURI` — ReferenceError at doc load in worker scope). Generation-guarded load/render/cancel/dispose protocol (header comment); load/dispose are **serialized through an internal promise chain with the previous document's `destroy()` awaited** before the next `getDocument` — pdf.js caches one PDFWorker per `workerPort` and a `getDocument` racing an unawaited destroy throws "PDFWorker.fromPort - the worker is being destroyed", which used to fail every re-adoption (project switch / re-upload / page append) into permanent session fallback (production `render_worker_fallback` "doc-load: …" telemetry). NOT a `<script>` tag — constructed as `new Worker('/render-worker.js')` by the service; precached in sw.js for offline |
| [tile-grid.spec.js](tile-grid.spec.js) | Playwright regression for the **deep-zoom tile compositor** — forced DPR clamp + zoom 3: multiple 512-css-px tiles raster center-out (via the render service) and composite onto #cropCanvas with ink over the visible window; panning grows the cache and the compositor follows; a page flip empties the grid and a sharp zoom retires the overlay. `npx playwright test tile-grid.spec.js` |
| [pyramid-persist.spec.js](pyramid-persist.spec.js) | Playwright regression for the **persistent pyramid** — rung captures persist to IndexedDB (`persisted` stat), then a REAL page reload + reload of the same file restores them (`restored` stat) without new rasters. `npx playwright test pyramid-persist.spec.js` |
| [doc-warmup.spec.js](doc-warmup.spec.js) | Playwright regression for the **full-document warm-up** (prefetch tier 3) — a spec-crafted 5-page PDF: once the near-field candidates settle, the idle walk visits every page outward from the current one (prefetch rasters for pages beyond current±1 in the render-service log; `App.__docWarmupState()` reaches done = pages−1), fit rungs land in the persistent pyramid (`persisted` stat), and a first visit to the LAST page paints with cache hits gained. Also pins the three feel-polish behaviors: the status-bar **warm-up hint** (`#statusWarmup` — "Preparing pages N/M" while the walk runs, hidden at completion), **marked-pages-first** ordering (a seeded marker on a far page makes it lead the far-field walk), and the **cold-flip white-out** (a flip with no cached bitmap at any rung clears the canvas to paper-white within a frame instead of showing the PREVIOUS sheet for the whole raster — asserted with a raster test-delay + pixel sampling). `npx playwright test doc-warmup.spec.js` |
| [pyramid.spec.js](pyramid.spec.js) | Playwright regression for the **downsample pyramid** — after the initial render's capture, the rungs below the current zoom appear in the cache flagged `derived` (stats.derived ≥ 2) without raster requests; a zoom-out wheel commit then blits from a derived rung (miss stat frozen, hits gained); the derived base has real ink. `npx playwright test pyramid.spec.js` |
| [instant-feel.spec.js](instant-feel.spec.js) | Playwright regression for the **instant-feel pass** — with rung ±2 prefetched, a continuous 8-tick wheel gesture swaps the base buffer MID-GESTURE via cache blits (distinct buffer sizes ≥ 2 before any commit debounce); a counter-placement click paints the mark immediately but leaves the sidebar sentinel alive (the debounced ~120ms tail refresh then lands); `App.__perfSamples` reports all five latency rings with p50/p95. `npx playwright test instant-feel.spec.js` |
| [render-worker.spec.js](render-worker.spec.js) | Playwright regression for the render worker — lazy adoption reaches `ready` after boot, a forced cold raster is `workerRastered` with zero fallbacks and real canvas content, page flips work end-to-end, and the `DISABLE_RENDER_WORKER` escape hatch keeps everything main-thread (`mode 'main'`, adoption never kicks). Plus the **dense-sheet worker-scope guards**: a spec-crafted tiling-pattern PDF (byte-accurate inline builder) must worker-raster with zero fallbacks and the worker still `ready` (the aux-canvas factory crash), and the embedded-font `samples/sample-plan.pdf` must render ink-identical (<0.3%) between worker and main modes (the black-box glyph failure). Plus the **re-adoption destroy race**: a rapid double project-load (two back-to-back re-uploads, each a new pdf.js document adopted into the live worker) must stay worker-rastered with zero fallbacks — the unawaited-destroy `PDFWorker.fromPort` failure used to flip the session to `failed` on the FIRST re-adoption. Every other spec exercises the worker path implicitly in Chromium. `npx playwright test render-worker.spec.js` |
| [canvas-draw.test.js](canvas-draw.test.js) | Node `node:test` unit tests for [canvas-draw.js](canvas-draw.js) — a recording 2D-context Proxy stub + stubbed `Path2D`, geometry/icons globals via `Object.assign(globalThis, require(...))` (10 tests): `hexToRgb` parse/fallback, `lineStyleToDash`, `drawDropMarker` glyph/save-restore/default color, room boxes (label vs "no scale" vs tiny-box skip), and `drawAnnotationsCore` env invariants — selection glow doubles width + shadow (live) vs absent (export), `fontFamily`/`fontScale` flow into labels and notes while counter numbers stay `DM Sans`, note handles gated on `drawNoteHandles`, group dots at `env.dotRadius`, hollow vs solid counter rings + outline, and the frozen paint order; run with `npm run test:unit` |
| [zoom-ladder.spec.js](zoom-ladder.spec.js) | Playwright regression for the **zoom ladder** (commit-snap to rungs; `snapZoomToRung`/`nextRungUp`/`nextRungDown` in constants.js) — ± buttons step exactly one rung and invert; a wheel gesture keeps a continuous preview but its COMMIT lands on a rung with the cursor anchor preserved (±2px); bouncing between visited rungs adds zero visible-path rasters (cache-miss stat frozen, hits +4) — the point of the feature. `npx playwright test zoom-ladder.spec.js` |
| [rung-prefetch.spec.js](rung-prefetch.spec.js) | Playwright regression for the **adjacent-rung idle prefetch** — after a commit lands on a rung, `runPdfBitmapPrefetch` warms rung±1 of the current page (before the neighbor-page fit prefetches); asserts the prefetched stat rises and the next `doZoomIn` needs zero new pdf.js render calls (pure blit). `npx playwright test rung-prefetch.spec.js` |
| [commit-tile.spec.js](commit-tile.spec.js) | Playwright regression for **window-first cold commits** — wraps `pdfPage.render` so full-page rasters resolve ~1.2s late (tile renders run native), then asserts: a cold-rung wheel commit shows the sharp visible-window tile while the old base is still up, the committed zoom is already on a rung, the tile retires when the crisp base paints, and a warm commit (down-rung prefetched — gated on `App.__pdfBitmapCacheKeys`, since the `prefetched` stat is a lifetime counter) blits with no tile. `npx playwright test commit-tile.spec.js` |
| [crop-tile.spec.js](crop-tile.spec.js) | Playwright regression for the **deep-zoom sharp crop tile** (`#cropCanvas`, `// SECTION: Deep-zoom sharp crop tile` in app.js) — forces an `effectiveDpr` clamp via `App.setCanvasCaps` + zoom 3, then asserts the tile appears with ink after the 200ms debounce, covers the visible window at the right content-space position, respects the render-area budget, sits below the annotation overlay (z-order + DOM order), clears immediately on a page flip (`renderPdf` entry), and retires at a sharp zoom; no console/page errors. `npx playwright test crop-tile.spec.js` |
| [render-pixels.spec.js](render-pixels.spec.js) | **The pixel-regression safety net** for the draw paths — seeds a fixture takeoff exercising every mark kind (straight + arc quick lines with drops/labels/selection glow, closed polyline, highlight, multiply + scale zones, room box, wrapping note, counters with rings/outline/index numbers, group dots, legend, grid), then compares the raw canvas buffers of the live overlay (`renderAnnotations` → `#annCanvas`) and two export renders (`renderAnnotationsToContext` at export scale with `lineScale`/`markerScale`, and via `annotationsOverride`) against committed baselines in `render-pixels.spec.js-snapshots/` with `maxDiffPixels: 0`. Baselines are machine-rasterized — regenerate on a new machine with `--update-snapshots`. `npx playwright test render-pixels.spec.js` |
| [features/canvas-repair.js](features/canvas-repair.js) | First feature-file split of the `app.js` IIFE (the `window.App` registry pilot) — the Canvas Repair modal (`openCanvasRepairModal` + `applyCanvasRepair`). Its own classic-script IIFE loaded **after** [app.js](app.js) (and before [report.js](report.js)); reads shared `state`/helpers from `window.App` at call time and registers `App.openCanvasRepairModal`/`App.applyCanvasRepair` back onto it. app.js invokes them via deferred bindings (`() => App.fn()`). See "Feature files / `window.App` registry" below |
| [canvas-repair.spec.js](canvas-repair.spec.js) | Playwright regression for the registry pilot — uploads `test-2pages.pdf`, adds a page-0 marker, asserts `window.App.openCanvasRepairModal`/`applyCanvasRepair` are functions and `App.state === window.state`, opens the modal + clicks `#canvasRepairApply` (no-op default mapping), and asserts the marker survives with no console / page errors; `npx playwright test canvas-repair.spec.js` |
| [features/note.js](features/note.js) | Second feature-file split (`window.App` registry pilot #2) — the Note add/edit modal (`openNoteModal` + its `noteModalCancel`/`noteModalDone` button bindings). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openNoteModal`, and binds the modal's Cancel/Done at load. app.js's 5 inbound call sites (canvas click / dblclick / context-menu / touch handlers) call it via `App.openNoteModal(...)` |
| [note.spec.js](note.spec.js) | Playwright regression for pilot #2 — uploads `test-2pages.pdf`, asserts `window.App.openNoteModal`/`ensureActiveCanvas`/`showLineColorModal` are functions, then exercises add (type + `#noteModalDone` persists a note), edit (reopen on the note object, change text), and cancel (`#noteModalCancel` clears `pendingNote`/`editingNote` and adds nothing), reading notes back via `window.App.ensureActiveCanvas`; asserts no console / page errors; `npx playwright test note.spec.js` |
| [features/zoom.js](features/zoom.js) | Third feature-file split (`window.App` registry pilot #3) — the Zoom Settings modal (`showZoomModal` + its `zoomModalClose`/`zoomMax`/`zoomSpeed` handlers). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.showZoomModal`, binds the modal inputs at load. `getMaxZoom`/`getWheelZoomSpeed` stay defined in app.js (used in ~10 places there) and are read via `App.*` — the first "publish-only, do-not-move" dep. its inbound call sites are the Zoom Rail's gear button ([features/zoom-rail.js](features/zoom-rail.js)) — the zoom-% click itself only toggles the rail |
| [features/zoom-rail.js](features/zoom-rail.js) | The **Zoom Rail** — the giant floating vertical zoom slider on the right edge, **toggled** by clicking the footer zoom-% (`#zoomPct`). Log-scale track (equal distance per doubling, 0.2 → `getMaxZoom()`) with round-percent tick marks (majors labelled), an accent-yellow %-readout draggable thumb with a light magnetic snap to ticks, +/− buttons, and a gear that opens the Zoom Settings modal (the modal's only entry point — the rail's z-index 300 sits above the modal overlay's 200, so both stay usable together). Drags anchor the zoom at the canvas-wrapper center and reuse app.js's cheap transform preview + debounced commit. Replaced the old `#zoomOverlay` popover (markup/handlers/dismisser removed). Registers `App.openZoomRail`/`App.closeZoomRail`/`App.toggleZoomRail` plus the `App.onZoomRailSync` core-→-feature callback (called from `updateUI` and the pinch rAF so the thumb tracks wheel/pinch/±/fit while open; also rebuilds ticks when Zoom Settings changes the max zoom, and closes the rail if the project unloads). Five publish-only deps `doZoomIn`/`doZoomOut`/`updateContainerTransform`/`commitWheelZoom`/`syncZoomIndicators` (the drag's per-move sync is the light `syncZoomIndicators` — zoom-% + thumb only, **never** the full `updateUI()`, whose all-pages sidebar rebuild made zoom gestures lag on large projects; the full `updateUI()` runs once in the commit — see [zoom-no-updateui-during-gesture.spec.js](zoom-no-updateui-during-gesture.spec.js)). Dismissal: re-click the zoom %, outside click (clicks inside `#zoomModal` don't count), or Escape — the rail **stays until dismissed** (B9/J15 removed the old ~5s idle auto-fade, an invisible timer that lost the rail mid-adjustment on a field pause) |
| [zoom-rail.spec.js](zoom-rail.spec.js) | Playwright regression for the Zoom Rail — uploads `test-2pages.pdf`, asserts the registry contract (`openZoomRail`/`closeZoomRail`/`toggleZoomRail`/`onZoomRailSync` + the 4 publish-only deps), `#zoomPct` click toggles the rail (modal does **not** open; gear opens it with the rail staying up), mouse-drags the track past the ends asserting `state.zoom` rises to max then clamps to 0.2 with `#zoomPct` in sync, stays-until-dismissed persistence (B9: no idle auto-fade; unrelated `updateUI` churn doesn't dismiss it either) + the accent-yellow thumb, tick rebuild when max zoom changes 400% → 1200% (8 → 11 ticks), external `state.zoom` writes resync the thumb, mobile viewport tap shows the rail without the modal (and `#zoomOverlay` is gone), and outside-click + Escape dismiss; asserts no console / page errors; `npx playwright test zoom-rail.spec.js` |
| [page-switch-cache.spec.js](page-switch-cache.spec.js) | Perf regression for the **PDF render bitmap cache** (`// SECTION: PDF render bitmap cache` in app.js) — the LRU of recently-rendered page ImageBitmaps keyed by the self-validating tuple (pdfPage proxy + rotation + zoom + effDpr) that makes revisits and idle-prefetched neighbor visits a synchronous blit instead of a pdf.js raster. Wraps each page's `pdfPage.render` with a call-counting spy, then asserts: a revisit adds **zero** render calls with `App.__pdfBitmapCacheStats().hits` incremented and real canvas content; rotate + undo (which rewrites `page.rotation` in place) both force fresh rasters (key self-invalidation); 12 rapid no-wait page flips ride the new `pdfRenderTask.cancel()` path with no console errors and land on the right page; the ~250ms idle prefetch caches the neighbor so its first visit is a blit; and `App.clearPdfBitmapCache()` empties to size 0. `npx playwright test page-switch-cache.spec.js` |
| [zoom-no-updateui-during-gesture.spec.js](zoom-no-updateui-during-gesture.spec.js) | Perf regression for the zoom-gesture paths — asserts wheel zooming does **not** run the full `updateUI()` per frame (sentinel child planted in `#pagesList` must survive the gesture — any `updateUI()` wipes it via `renderPagesList`'s innerHTML rebuild), that `#zoomPct` still tracks `state.zoom` per frame via the light `syncZoomIndicators()` (published on the registry), and that exactly one full `updateUI()` + re-render lands at the debounced `commitWheelZoom` (sentinel gone after the 150 ms window); uploads `samples/sample-plan.pdf`; asserts no console / page errors; `npx playwright test zoom-no-updateui-during-gesture.spec.js` |
| [zoom.spec.js](zoom.spec.js) | Playwright regression for pilot #3 — uploads `test-2pages.pdf`, asserts `window.App.showZoomModal`/`getMaxZoom`/`getWheelZoomSpeed` are functions, opens via `window.App.showZoomModal()`, sets `#zoomMax` to 600 + `#zoomSpeed` to 200 (dispatching `input`), clicks `#zoomModalClose`, and asserts `state.maxZoom === 6` and `localStorage.zoomSettings.wheelZoomSpeed === 2` with no console / page errors; `npx playwright test zoom.spec.js` |
| [features/manage-icons.js](features/manage-icons.js) | Fourth feature-file split (`window.App` registry pilot #4) and the **first multi-region move** — the Manage Icons modal (`openManageIconsModal` + its `manageIconsModalClose`/`manageIconsCancel`/`manageIconsSave` handlers, which lived in app.js's event-binding block, a region away from the opener). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openManageIconsModal`, binds the modal's Close/Cancel/Save at load. `getOrderedIcons`/`iconVbFor`/`getUserCustomIcons`/`saveUserCustomIcons`/`showToast` stay defined in app.js (each used 10-15× there) and are read via `App.*` — publish-only deps. The Save handler reads `App.getOrderedIcons().find(...)` (ordered icon objects) instead of the bare `ICONS` array, and preserves the existing no-`markProjectDirty` behavior. The single user-facing call site (the counter Create tab's "Manage icons…" link, `#counterManageIcons` in [features/counter.js](features/counter.js) — re-homed out of Settings → Advanced, T2 #29) calls `App.openManageIconsModal()` |
| [manage-icons.spec.js](manage-icons.spec.js) | Playwright regression for pilot #4 — uploads `test-2pages.pdf`, asserts `window.App.openManageIconsModal` + the 5 publish-only deps (`getOrderedIcons`/`iconVbFor`/`getUserCustomIcons`/`saveUserCustomIcons`/`showToast`) are functions, then exercises rename (set the first built-in row's input, `#manageIconsSave`, assert `state.iconNames[firstPath]`), reorder (reopen, `button[data-action="bottom"]` on the first row, Save, assert `state.iconOrder` ends with the former-first path), and custom delete (seed via `App.saveUserCustomIcons`, reopen, `#manageIconsEditToggle`, check the custom row's `.icon-select-cb`, `#manageIconsDeleteSelected`, assert `getUserCustomIcons().length === 0` and the custom section hides); asserts no console / page errors; `npx playwright test manage-icons.spec.js` |
| [features/multiply-zone-settings.js](features/multiply-zone-settings.js) | Fifth feature-file split (`window.App` registry pilot #5) and the **first needing no new published deps** — the Multiply Zone **settings** modal (`openMultiplyZoneSettingsModal` + its `multiplyZoneSettingsShowLabelBtn`/`multiplyZoneSettingsLabelSize`/`multiplyZoneSettingsClose` handlers). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openMultiplyZoneSettingsModal`, binds the modal's toggle/slider/Close at load. Every dep (`state`, `showModal`, `hideModal`, `markProjectDirty`, `renderPdf`, `updateUI`) was already on `App`. Scope is the settings modal only — the Multiply Zone **apply** flow (X-tool draw, `multiplyZoneModal`, `getMultiplyZoneForPoint`/`...ForLine`) stays in app.js. app.js's 2 call sites (right-click on the header / sidebar Multiply Zone button) call `App.openMultiplyZoneSettingsModal()` |
| [multiply-zone-settings.spec.js](multiply-zone-settings.spec.js) | Playwright regression for pilot #5 — uploads `test-2pages.pdf`, asserts `window.App.openMultiplyZoneSettingsModal` is a function, opens via the registry, sets `#multiplyZoneSettingsDefaultMult` to 5 + `#multiplyZoneSettingsLabelSize` to 20 (dispatching `input`, asserting `#multiplyZoneSettingsLabelSizeVal` reads `20`), clicks `#multiplyZoneSettingsShowLabelBtn` to toggle the label off, sets position to `top-left`, clicks `#multiplyZoneSettingsClose`, and asserts `state.multiplyZoneSettings` deep-equals `{ showLabelOnZone: false, defaultMultiplier: 5, labelSize: 20, labelPosition: 'top-left' }` with no console / page errors; `npx playwright test multiply-zone-settings.spec.js` |
| [features/scale-zone-settings.js](features/scale-zone-settings.js) | The Scale Zone **settings** modal — sibling of [features/multiply-zone-settings.js](features/multiply-zone-settings.js), born from a field report (the zone's fallback `0.23 ft/pt` label rendered dead-center over the fixtures being counted; scale zones previously had **no** label controls — always shown, centered, size borrowed from `multiplyZoneSettings`). Registers `App.openScaleZoneSettingsModal` (called from the Scale Zone toolbar/sidebar right-click via [features/tool-context-menu.js](features/tool-context-menu.js) — the button moved OUT of that file's no-settings toast list); binds the `#scaleZoneSettings*` toggle/slider/Close at load. Commits `state.scaleZoneSettings` `{ showLabelOnZone, labelSize (8–24), labelPosition }` — default position **top-left** — consumed by the scale-zone block in [canvas-draw.js](canvas-draw.js) (which also factors the shared `zoneLabelLayout` corner/center placement helper used by both zone kinds). Setting rides save/load + export/import + the IndexedDB backup alongside `multiplyZoneSettings`. Zero new published deps (close re-renders via `App.renderAnnotations` — annotation-only, no re-raster) |
| [scale-zone-settings.spec.js](scale-zone-settings.spec.js) | Playwright regression for the Scale Zone settings modal — uploads `test-2pages.pdf`, asserts `App.openScaleZoneSettingsModal` is registered and `App.__toolContextMap()` lists `scaleZoneBtn: ['Scale Zone Settings…']` (and NOT in `noSettings`), asserts the state defaults `{ showLabelOnZone: true, labelSize: 14, labelPosition: 'top-left' }`, opens via the registry, sets size 10 (live `#scaleZoneSettingsLabelSizeVal` check), toggles the label off, sets position `bottom-right`, closes, and asserts the committed `state.scaleZoneSettings`; no console / page errors; `npx playwright test scale-zone-settings.spec.js` |
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
| [features/choose-create-line-type.js](features/choose-create-line-type.js) | Twelfth feature-file split (`window.App` registry pilot #12) — the **Choose/Create Line Type** modal (`#chooseLineTypeModal`), the tabbed picker opened by the Quick Line button / `L` hotkey. `showLineTypeTab` (Choose/Create/Quick panels) + `populateChooseLineTypeList` (searchable existing-type list) + `showChooseLineTypeModal`, plus the `.line-type-tab` clicks, `#lineTypeModalSearchInput`, `#chooseLineTypeCancel`, `#createLineTypeCancel`, and `#createLineTypeCreate` handlers. Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.showChooseLineTypeModal` + `App.showLineTypeTab`, binds everything at load. **First split to share *constants* via the registry** — two new publish-only deps `TOOL`/`COLORS` (it also consumes `App.populateQuickLineModal`, which since pilot #16 is registered by [features/quick-line.js](features/quick-line.js), not app.js); `state`/`uid`/`pushUndoSnapshot`/`markProjectDirty`/`showModal`/`hideModal`/`updateUI` were already on `App`. Scope is this modal only — the **line color modal** (`showLineColorModal`/`applyLineColor` + `#lineColorCancel`/`#lineColorCustom`), the Quick tab body (`populateQuickLineModal`), and the Quick Line apply flow stay in app.js. The call sites — `#quickLine.onclick` and the Shift+L hotkey (the dead `#plumLineBtn` opener was deleted in Tier-3 B17) — reach it via `App.showChooseLineTypeModal()` / `App.showLineTypeTab('quick')` — though since T2-08 `#quickLine` skips the chooser when exactly one line type exists (selects + arms it directly), and the New Polyline modal's dead "Create new line type" link (an anchor with no handler anywhere) is removed from app/index.html. `#createLineTypeCreate` now arms via `App.armLineToolAfterCreate` (publish-only app.js registry entry shared by all line-type create surfaces: scale-gated, no-op mid-polyline or with no plan open) instead of an inline `state.tool` triple. **Renamed** the section marker `// SECTION: Choose/Create Line Type, line color & sidebar handlers` → `// SECTION: Line color & sidebar handlers` (TOC stays 49) |
| [choose-create-line-type.spec.js](choose-create-line-type.spec.js) | Playwright regression for pilot #12 — uploads `test-2pages.pdf`, asserts `window.App.showChooseLineTypeModal` + `showLineTypeTab` are functions, opens via the registry, switches to the Create tab and creates a line type (asserts `state.lineTypes` grew by 1, `state.activeLineTypeId` points at the new type, and the modal closed), reopens and exercises the Choose-list search + select (asserts the modal closes and `state.activeLineTypeId` matches the picked type); plus the three T2-08 arm-on-create cases — scaled sidebar + Add arms the Line tool and two canvas clicks commit a quick line of the new type; unscaled create selects the type, stays in Move, shows `#setScaleFirstModal`; `#quickLine` skips the chooser at exactly one type and opens it at two; asserts no console / page errors; `npx playwright test choose-create-line-type.spec.js` |
| [features/scale.js](features/scale.js) | Thirteenth feature-file split (`window.App` registry pilot #13) — the **Scale modal** (`#scaleModal`), opened by the Set Scale buttons / `S` hotkey and reused for per-page scale, scale-zone create, and scale-zone edit. `openScaleModal` is the **one no-plan gate** for every scale entrance ("Open a plan first." toast at 0 pages — the header/sidebar buttons, the S hotkey, the tool context menu, and the arm-time gate link all funnel through it; Tier-3 B8 / J3) and re-seeds the custom feet field's real default `1` when left empty; the page-mode info line reads "Tap Select on PDF, then tap two points …" on coarse pointers (`App.isCoarsePointer`, Tier-3 B9 / J15); a **new-zone** apply keeps the Scale Zone tool armed with an armed-hint toast (Tier-3 B8 / J6, counter-tool pattern — context-menu zone edits still exit to Move, the T1-04 verify hand-off untouched). `updateScalePlaceholder` + `openScaleModal` + `resetScaleModalZoneMode` + `applyScaleObjectToZoneOrPage` + `showScaleTab`, plus the `#setScale`/`#setScaleSidebar` openers and the `#scaleModalTabs`/`#scaleUnit`/`#scaleSelectOnPdf`/`#scalePresetsCancel`/`#scaleCustomApply`/`#scaleCancel`/`#scaleSet` handlers (which had lived down in the Counter-modal region). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openScaleModal` + `App.resetScaleModalZoneMode`, binds everything at load. **First split to route geometry.js globals + `SCALE_*` constants through the registry** — six new publish-only deps `SCALE_MODES`/`SCALE_PRESETS`/`ptDist`/`parseFraction`/`parseRealWorldLength`/`getActiveAnnotations` (stay in app.js, read via `App.*` so the `features/*.js` group's browser-only globals don't trip `no-undef`); `state`/`showModal`/`hideModal`/`updateUI`/`renderPdf`/`pushUndoSnapshot`/`markProjectDirty`/`uid`/`ensureActiveCanvas`/`showToast`/`TOOL` were already on `App`. The modal doubles as the scale-zone create/edit dialog (`scaleModalApplyTarget === 'zone'`), so `applyScaleObjectToZoneOrPage` moves with it; every scale commit (the three page-apply sites + the zone apply) also fires the defensive `App.onScaleApplied` copy-resume callback ([features/output.js](features/output.js), Tier-3 B3); the four `openScaleModal` callers (canvas two-point finish + scale-zone context-menu Edit) and the Escape-key `resetScaleModalZoneMode` branch keep their zone-entry state/DOM setup inline and reach the modal via `App.*`. The toolbar tool buttons (`#measureBtn`/`#moveBtn`/`#quickLine`/`#undoBtn`/`#redoBtn`/`#polylineBtn`/`#highlightBtn`/`#multiplyZoneBtn`/`#scaleZoneBtn`/`#deleteZoneBtn`) that shared the grab-bag stay in app.js. **Renamed** the section marker `// SECTION: Scale modal` → `// SECTION: Toolbar tool buttons` (TOC stays 49) |
| [scale.spec.js](scale.spec.js) | Playwright regression for pilot #13 — uploads `test-2pages.pdf`, asserts `window.App.openScaleModal` + `resetScaleModalZoneMode` are functions and `Array.isArray(App.SCALE_PRESETS)`, opens via the registry, clicks a preset and asserts `state.pages[currentPage].scale` was set + the modal closed, reopens and exercises `#scaleCustomApply` with a valid fraction + feet asserting the computed `pixelsPerUnit` + closed modal; asserts no console / page errors; `npx playwright test scale.spec.js` |
| [scale-modal-fixes.spec.js](scale-modal-fixes.spec.js) | Playwright regression for the **Tier-3 B8 scale-modal small fixes** — the custom feet field ships the real default `1` (fresh open, re-seeded after clearing, typed values kept, fraction-only Apply works); every scale entrance (header + sidebar buttons, `S` hotkey, the bare `App.openScaleModal` registry mouth) refuses at 0 pages with the shared "Open a plan first." toast and no fake "Scale set" success; both zone tools stay armed after Apply with the visible armed-hint toast, the re-armed tool still takes the T2-10 drag for the next zone, Esc exits to Move, and a context-menu zone EDIT still exits to Move with no hint. Asserts no console / page errors; `npx playwright test scale-modal-fixes.spec.js` |
| [features/groups.js](features/groups.js) | Fourteenth feature-file split (`window.App` registry pilot #14) and **first two-modal move** — the group create/edit modal (`#groupModal`) and the assign-item-to-group modal (`#groupAssignModal`). `openGroupModal` + `refreshGroupAssignButtons` + `openGroupAssignModal`, the three group-modal state flags (`pendingGroupEdit`/`pendingGroupAssignTarget`/`openedGroupModalFromAssign`, now private `let`s in the IIFE), and the `#addGroup` opener + `#groupModal*` / `#groupAssign*` handlers. Its own IIFE loaded **after** [app.js](app.js); registers `App.openGroupModal` + `App.openGroupAssignModal` + `App.onGroupModalHidden`. One new publish-only dep `App.deleteGroup` (the heavier group-deletion mutation, which clears the group off every annotation, stays in app.js); the rest (`state`/`COLORS`/`uid`/`pushUndoSnapshot`/`markProjectDirty`/`updateUI`/`renderPdf`/`showModal`/`hideModal`) were already on `App`. **First core-function → feature callback in the codebase**: the `hideModal('groupModal')` reset hook in app.js now calls `App.onGroupModalHidden()` instead of mutating the now-private `openedGroupModalFromAssign` directly. The `#showGroupColors` sidebar toggle stays in app.js; the two external callers (the groups-list Edit button in the render code, and the canvas right-click "Assign to Group") reach the modals via `App.*`. **Removed** the emptied `// SECTION: Groups` marker (TOC 49 → 48) |
| [groups.spec.js](groups.spec.js) | Playwright regression for pilot #14 — uploads `test-2pages.pdf`, asserts `window.App.openGroupModal` + `openGroupAssignModal` + `onGroupModalHidden` are functions, creates a group via `#addGroup` → name/color → `#groupModalDone` (asserts `state.groups` grew + `state.activeGroupId` points at it), edits via `App.openGroupModal(group)`, and runs the assign flow (`App.openGroupAssignModal(item)` → pick a group → `#groupAssignDone` sets `item.group`); asserts no console / page errors; `npx playwright test groups.spec.js` |
| [features/grid.js](features/grid.js) | Fifteenth feature-file split (`window.App` registry pilot #15) — the Grid Settings modal (`#gridSettingsModal`) + the grid-overlay toggle, carved out of the `// SECTION: Counter modal` grab-bag. `toggleGridOverlay` + the `gridBtn`/`gridBtnSidebar` bindings + the `#gridSettingsCancel`/`#gridSetOriginOnPage`/`#gridClearOrigin`/`.gridSpacingPreset`/`.grid-line-style-opt`/`#gridSettingsApply` handlers. Its own IIFE loaded **after** [app.js](app.js); registers `App.toggleGridOverlay` (only for the spec/symmetry — nothing in app.js calls it; the Grid buttons are bound inside the feature, and there is no grid hotkey) and `App.openGridSettingsModal` (the toggle's enable path extracted as its own function — populate + show **without** toggling the overlay; the tool-context-menu right-click target). Two new publish-only deps `App.getPageScale` + `App.showSetScaleFirstToast`; the rest (`state`/`markProjectDirty`/`renderPdf`/`updateUI`/`showModal`/`hideModal`/`showToast`/`parseRealWorldLength`) were already on `App`. The `drawGrid` renderer, the snap-to-grid branch, the render-code grid-button active/disabled toggling, and `resetGridOrigin` (a state reset used by the prepare-PDF / page-setup flows, not the modal) all stay in app.js. **No registry callback needed** for the "set origin on page" handoff (contrast Groups): the feature sets the shared `state.gridOriginPickMode` flag and the app.js canvas handler reads it, writes the origin, flips it false, and reopens the modal — because the flag lives on `state`, not a closure `let`. No `// SECTION:` marker change (the grab-bag keeps the counter modal + sidebar buttons + legend + `resetGridOrigin`), so TOC stays 48 |
| [grid.spec.js](grid.spec.js) | Playwright regression for pilot #15 — uploads `test-2pages.pdf`, asserts `window.App.toggleGridOverlay` is a function, sets a page scale via `state.pages[0].scale`, opens the modal with `App.toggleGridOverlay()`, sets `#gridSpacingValue` + `#gridSettingsApply` and asserts `state.gridSettings.spacing` + `state.showGridOverlay === true` + the modal closed; also asserts that with no page scale the open path shows the "Set Scale first" toast and does NOT open the modal; asserts no console / page errors; `npx playwright test grid.spec.js` |
| [features/quick-line.js](features/quick-line.js) | Sixteenth feature-file split (`window.App` registry pilot #16) — the Quick Line modal (the "quick" tab body of `#chooseLineTypeModal`): `populateQuickLineModal` + `updateQuickLineNamePreview` + `removeLineModifier`, plus the `#quickLineSize`/`#quickLineMaterial`/`#quickLineRemoveSize`/`#quickLineRemoveMaterial`/`#quickLineAddSize`/`#quickLineAddMaterial`/`#quickLineCancel`/`#quickLineAdd` handlers. Its own IIFE loaded **after** [app.js](app.js). **Takes over publishing `App.populateQuickLineModal`** — that publish moved here from app.js, and [features/choose-create-line-type.js](features/choose-create-line-type.js) keeps consuming it via `App.*` at call time (load order between the two feature files is irrelevant: registration at load, the call on user action). Two new publish-only deps `App.getLineModifiers` + `App.saveLineModifiers` (the line-modifier persistence stays in app.js); the rest (`state`/`COLORS`/`uid`/`pushUndoSnapshot`/`markProjectDirty`/`showModal`/`hideModal`/`updateUI`/`showLineColorModal`/`showLineTypeTab`) were already on `App`. The separate "Add Line Type" modal (`#addLineType`/`#lineTypeModal`) stays in app.js. Since T2-08, `#quickLineAdd` arms the drawing tool via `App.armLineToolAfterCreate` (the shared app.js arm-on-create helper — makes the quick-creators guide's "active, and ready to trace" claim true). **Renamed** the now-stale `// SECTION: Quick Line modal` marker → `// SECTION: Add Line Type modal` (rename, not removal, TOC stays 48) |
| [quick-line.spec.js](quick-line.spec.js) | Playwright regression for pilot #16 — uploads `test-2pages.pdf`, asserts `window.App.populateQuickLineModal` is a function, opens the quick tab (via `App.showLineTypeTab('quick')` — the dead `#plumLineBtn` opener was deleted in Tier-3 B17), asserts the `#quickLineSize`/`#quickLineMaterial` selects are populated, then `#quickLineAdd` creates a line type (asserts `state.lineTypes` grew + `state.activeLineTypeId` points at it + the modal closed + the Line tool armed — T2-08, on a scaled page); asserts no console / page errors. The cross-file handoff is also guarded by [choose-create-line-type.spec.js](choose-create-line-type.spec.js) (which exercises `showLineTypeTab('quick') → App.populateQuickLineModal()`); `npx playwright test quick-line.spec.js` |
| [features/counter.js](features/counter.js) | Seventeenth feature-file split (`window.App` registry pilot #17) — the Counter modal (`#counterModal`) choose/create-counter picker, an **interleaved** extraction from the Counter-modal grab-bag. `showCounterTab` + `showCounterIconTab` + `populateCounterChooseList` (Choose-tab badges show the multiply-adjusted **with-repeats** total via `App.counterTally` — T2-11, agreeing with the sidebar Counters badge per the T1-11 rule — with the placed count in the hover `title` when a zone makes them differ), the choose-tab handlers (`#counterBtn`/`.counter-tab`/`#counterModalSearchInput`/`#counterChooseCancel`) and the create-tab handlers (`#addCounter`/`.counter-icon-tab`/`#counterIconSearch`/`#counterCancel`/`#counterCreate`, plus `#counterManageIcons` — the Create-tab "Manage icons…" link, T2 #29: hides `counterModal` then calls `App.openManageIconsModal()`; hide-then-open is load-bearing because the Escape chain checks `counterModal` before `manageIconsModal`). Both openers share one private `prepCreatePanel()` (T2-05): it prefills `#counterName` with the **next unused** library icon's name (walks `getOrderedIcons()` against existing counter names, case-insensitive; falls back to icon[0]) and selects that cell, populates both icon grids and the color picker; `#counterBtn` lands on the **Create tab when `state.counters` is empty** (else Choose, as before). `showCounterIconTab` also toggles `#counterIconSearchGroup` (the built-in icon search, shipped un-hidden by T2-05 #18) to the Icon tab only, and `showCounterTab` toggles the `.counter-modal-search-row` to the Choose tab only (Tier-3 B17 — it filters only the Choose list; on Create/Quick it was an inert box) — the `#counterIconSearch` handler filters the built-in grid, not the custom one. `#counterCreate` resolves twins via the private pure-shaped `resolveCounterTwin(name, icon, color, counters, palette)` — a same-trimmed-name create gets the lowest free numbered suffix ("Water Closet 2"), and an exact name+icon+color twin also rotates to the first `COLORS` entry no counter uses (kept private-but-pure so T2 #16 / T2-07 can lift it); a blank name falls back to the selected icon's name — never the literal `'Counter'`. Both arm paths (a Choose-tab row pick and `#counterCreate`) also call the defensive `App.closeMobileSidebar()` (Tier-3 B9 / J1 J15) so the mobile left drawer closes when a tool is actually armed — a cancelled picker leaves the drawer where it was. Its own IIFE loaded **after** [app.js](app.js); registers `App.showCounterTab`. **Bidirectional quickcount coupling** (same shape as Quick Line): it consumes `App.populateCounterQuickCountPanel` (the quickcount tab body stays in app.js's Quick Count section), and the Shift+C hotkey reaches the tab via `App.showCounterTab('quickcount')` (the dead `#plumBtn` opener was deleted in Tier-3 B17). Three new publish-only deps `App.getIconName` + `App.getEffectiveCustomIcons` + `App.populateCounterQuickCountPanel`; the rest (`state`/`COLORS`/`TOOL`/`uid`/`pushUndoSnapshot`/`markProjectDirty`/`showModal`/`hideModal`/`updateUI`/`getOrderedIcons`/`iconVbFor`) were already on `App`. The interleaved neighbors (`#doneEditing`, the sidebar tool buttons, `toggleLegendOverlay` + legend buttons, the `iconVbFor` global helper) stay in app.js; the many `#counterBtn.click()` DOM triggers keep working since the handler moves with the element. **Renamed** the `// SECTION: Counter modal` marker → `// SECTION: Tool sidebar buttons & legend overlay` (rename, not removal, TOC stays 48) |
| [counter.spec.js](counter.spec.js) | Playwright regression for pilot #17 — uploads `test-2pages.pdf`, asserts `window.App.showCounterTab` is a function, creates a counter via the Create tab (`#addCounter` → name → `#counterCreate`, asserts `state.counters` grew + `state.activeCounterType` points at it + the modal closed), reopens and selects it from the Choose list (asserts the modal closes and `state.activeCounterType` matches); the T2-05 create-ergonomics cases: zero-counter `#counterBtn` lands on Create prefilled with icon[0]'s name + cell selected + custom grid populated and the Choose empty state reads "No counters yet — use the Create tab above.", `#addCounter` prefill walks to the next **unused** icon's name, the twin guard suffixes + rotates color on an exact twin (suffix only when the color differs), a blank name creates under the selected icon's name (never the literal "Counter"), and the icon search group is visible on the Icon tab / hidden on Custom Icons with live grid filtering; the T2-11 badge cases: the Choose-tab badge shows the with-repeats total under a multiply zone with the `"N placed · M with repeats"` hover title, and no tooltip renders in the zone-free fixture; asserts no console / page errors; `npx playwright test counter.spec.js` |
| [features/save-status.js](features/save-status.js) | Eighteenth feature-file split (`window.App` registry pilot #18) and **first save/sync-domain UI split** — the on-demand Save Status modal (`#saveStatusModal`): `renderSaveStatusModalContent` + `openSaveStatusModal` + the render helpers `escSaveStatusHtml`/`applySaveStatusSummaryBlock` + the bell open buttons and `#saveStatusModalClose`/`#saveStatusModalDone`/`#saveStatusVerboseToggle`/`#saveStatusExportBtn`/`#saveStatusCopyBtn` handlers; the modal's `saveStatusModalTickTimer` is now a private `let`. Its own IIFE loaded **after** [app.js](app.js); registers `App.openSaveStatusModal` + `App.renderSaveStatusModalContent` (the latter is also called by the checkout-expired recovery re-check handler). The **hot-path bell** `updateSaveStatusIndicator` (called from 25+ sites incl. updateUI) and the whole save engine stay in app.js. Seven new publish-only deps (`getCloudSaveSummary`, `pruneSaveStatusLog`, `getSaveStatusLogWindowMs`, `isSaveDebugEnabled`, `setSaveDebugEnabled`, `buildSaveLogsEnvelopeWithSnapshots`, `pushSaveEvent`) plus **two getter accessors** `App.getSaveStatusLog()` + `App.isCheckoutExpiredAttention()` — used instead of value publishes because the underlying app.js vars (`saveStatusLog` reset to `[]`; `checkoutExpiredNeedsAttention` with many engine writers) are reassigned and a captured reference would go stale. `#syncPausedBannerRetry` stays in app.js. **Removed** the emptied `// SECTION: Save Status modal` marker (TOC 48 → 47). **Tier-3 B11 (J12)**: `renderSaveStatusModalContent` also toggles the `#saveStatusSignedOutHint` line ("Sign in to sync across devices.", app/index.html) — shown only when Supabase is enabled and no user is signed in; the signed-out summary rows themselves come truthful from `getCloudSaveSummary` (green "Saved on this device" + the local stamp's clock/ago when an IDB backup exists) |
| [save-status.spec.js](save-status.spec.js) | Playwright regression for pilot #18 — asserts `window.App.openSaveStatusModal` is a function, opens via `App.openSaveStatusModal()`, asserts `#saveStatusModal.visible` + the `#saveStatusEventList` renders, toggles `#saveStatusVerboseToggle`, asserts the `#saveStatusExportBtn`/`#saveStatusCopyBtn` exist and clicking does not throw (without asserting clipboard/download contents), closes via `#saveStatusModalClose`; asserts no console / page errors; `npx playwright test save-status.spec.js` |
| [features/manage-projects.js](features/manage-projects.js) | Nineteenth feature-file split (`window.App` registry pilot #19) — the admin Manage Projects modal (`#manageProjectsModal`): `openManageProjectsModal` (lists projects via the `list_projects_for_admin` RPC), the internal `forceCheckInProjectFromManage` (`force_check_in_project` RPC) + `deleteProject` (`admin-delete-project` Edge Function), and the `#manageProjectsModalClose` handler. Its own IIFE loaded **after** [app.js](app.js); registers `App.openManageProjectsModal`. **Cloud-coupled** — it reaches the Supabase client via **`App.getSupabase()`** (the second getter-accessor: `supabase` is reassigned by the client-recycle `recreateSupabaseClient`, so a value publish would go stale). Five other new publish-only deps: the env constants `SUPABASE_URL`/`SUPABASE_ANON_KEY`, and the engine helpers `updateServerClockFromRpc`/`clearCheckoutExpiredAttention`/`resetAutoRecheckoutCounter` (the last published as a **deferred wrapper** `App.fn = (a) => fn(a)` since it is a sloppy-mode hoisted block declaration); `state`/`showModal`/`hideModal`/`showToast` were already on `App`. The `#settingsManageProjects` opener (now `App.openManageProjectsModal()`) and the Escape-key close branch stay in app.js. **Renamed** the `// SECTION: Manage Projects modal` marker → `// SECTION: Auth & settings entry buttons` (the auth/settings entry-button block that shared it stays; rename, not removal, TOC stays 47) |
| [manage-projects.spec.js](manage-projects.spec.js) | Playwright regression for pilot #19 — an always-run registry-contract test (asserts `window.App.openManageProjectsModal` is a function and that calling it with no session is a safe no-op: `#manageProjectsModal` does not become visible and nothing throws), plus a cloud-gated test (`ensureSignedInWithProject` from `cloud-test-helpers.js` in `beforeAll`, `test.skip` when no cloud secrets) that opens Settings → Manage Projects and asserts the project list + a Delete button render. Asserts no console / page errors; `npx playwright test manage-projects.spec.js` |
| [features/user-admin.js](features/user-admin.js) | Twentieth feature-file split (`window.App` registry pilot #20) — the admin user-management modals: `openManageUserModal` (user list + delete + activity, via `list_users_for_admin` RPC / `admin-list-users` Edge Fn), `openAllUsersModal` (read-only list), `deleteUser` (`admin-delete-user`), plus the `#manageUsersBtn` create-user opener + `#adminCreateForm` (`admin-create-user`) and the `#adminPanelClose`/`#manageUserModalClose`/`#allUsersModalClose`/`manageUserModalAllActivityBtn` handlers. Its own IIFE loaded **after** [app.js](app.js); registers `App.openManageUserModal` + `App.openAllUsersModal`. Three new publish-only deps: `App.formatLastSignIn` (a `format.js` global, lint-invisible to the features group so it must be published), `App.USER_ACTIVITY_ICON_SVG`, and `App.openUserActivityModal` (the User Activity modal **stays** in app.js; the moved lists + the all-activity button reach it via `App.*`); `state`/`showModal`/`hideModal`/`SUPABASE_URL`/`SUPABASE_ANON_KEY` were already on `App`. **My Settings** (`openMySettings`, which owns the airboard cloud-sync) deliberately stays in app.js under the renamed marker `// SECTION: My Settings modal`; its `#mySettingsManageUser`/`#mySettingsAllUsers` openers reach the feature via `App.*`. The moved handlers were interleaved with the User Activity + Canvas Repair handlers (which stay) in the Event Binding region. **Renamed** the `// SECTION: User Settings & Manage Users` marker → `// SECTION: My Settings modal` (rename, not removal, TOC stays 47). **Since extended** with the full Manage Users toolkit: an owned-`project_count` column (`list_users_for_admin` gained the count; clicking it opens `#userProjectsModal`, a per-user project list from `list_projects_for_admin`); a stacked last-sign-in/last-active cell; per-row **Set Password** (🔑 → `#setPasswordModal` → `admin-set-password`), **Transfer projects** (⇄ → `#transferProjectsModal` → `admin-reassign-projects`), and a **Delete** dialog (`#deleteUserConfirmModal`) that can **reassign** the user's projects to someone else before deleting (`admin-delete-user` with `reassignToUserId`); transfer/reassign share `supabase/functions/_shared/reassignProjects.ts`, which moves the project rows **and** their owner-scoped PDF storage objects, reassigns inherited view links, and clears redundant shares. Clicking the stacked dates cell or the heart icon opens the rich **Activity overview** `#userActivityOverviewModal` via `App.openUserActivityOverview` — the overview itself (and the `#mySettingsMyActivity` **My Activity** opener) **moved to [features/user-activity.js](features/user-activity.js)** so both activity surfaces live in one file. Manage Users rows also carry the **Overseer toggle** (👁, `.settings-user-overseer`, lit when `u.is_overseer`): POSTs the admin-guarded `admin_set_overseer` RPC then re-fetches; the Role column reads `Admin` > `Overseer` > `User` (from `list_users_for_admin` / the `admin-list-users` Edge Fn) |
| [user-admin.spec.js](user-admin.spec.js) | Playwright regression for pilot #20 — an always-run registry-contract test (asserts `window.App.openManageUserModal` + `openAllUsersModal` are functions and that calling them with no session is a safe no-op: the modals do not become visible and nothing throws), plus a cloud-gated test (`ensureSignedInWithProject`, `test.skip` when no cloud) that opens via `App.openManageUserModal()` and asserts `#manageUserModal.visible` + the list element gets content. Asserts no console / page errors; `npx playwright test user-admin.spec.js` |
| [features/load-project.js](features/load-project.js) | Twenty-first feature-file split (`window.App` registry pilot #21) and the **most dependency-heavy** so far — the cloud Load Project modal `openLoadProjectModal` (~585 lines: project browser list, ownership/role filters, per-row access panels + invite via `invite-to-project`, copy/download/delete row actions, and the project-load action). Its own IIFE loaded **after** [app.js](app.js); reads deps from `App` and re-reads `App.getSupabase()` in the outer fn + each nested async helper (client can be recycled); registers `App.openLoadProjectModal`. The save-before-load gate `openLoadProjectModalOrPromptSave` and the whole copy/fork domain live in [features/copy-project.js](features/copy-project.js) (split 2026-07-30 at this file's documented domain boundary); the `#loadProject*` bindings + Escape branch stay in app.js and reach both files through the registry at call time. The row renderer `renderLoadProjectListRows` is a thin loop over per-row helpers decomposed along its action boundaries (`computeLoadProjectRowSizeBytes` / `buildLoadProjectRowHtml` / `bindLoadProjectRowActions` / `bindLoadProjectAdminAccess` / `bindLoadProjectRowLoad`). Because the project-load action is fused with the boot/engine path, ~20 publish-only deps are exposed on `App` (`updateSaveStatusIndicator`, `canUseDevAuth`, `deleteProjectAsOwner`, `openCopyProjectModalOrPromptSave`, `hydrateProjectFromCloudRow`, `clearUndoStacks`, `subscribeToProjectCheckoutChanges`, `checkInCurrentProjectIfHeld`, `takeoffBackupGet`, `resolvePdfBufferForCloudProject`, `ensureGroupColors`, `openCanvasOnlyNeedsPdfModal`, `buildPagesFromPdfArrayBufferAndProjectData`, `backupDataToProjFormat`, `fitZoom`, `SUPABASE_URL`), incl. four **setters** (`setAutoSaveDirty`/`setLastModifiedAt`/`setLastLocalBackupAt`/`setLastSaveIncludedPdf`) for engine `let`-state the load resets (it cannot assign through the registry otherwise). The leftover grab-bag under the old `// SECTION: Load Project modal` marker was re-sectioned into 8 honest markers, and `// SECTION: Canvas Event Handlers` moved up to absorb the stray `showContextMenu`. The modal header has an admin-only **Advanced** toggle (`#loadProjectAdvancedToggle`, persisted via `loadProjectAdvanced`) that shows/hides every row's "Who has access" block by toggling a `hide-access` class on `#loadProjectList` (default OFF = hidden). The project-load action itself was extracted host-agnostic as `loadCloudProjectRow(proj, ui)` (registered `App.loadCloudProjectRow`; `ui` = `{hostModalId, showError}`) so [features/bid-board.js](features/bid-board.js) opens bids through the identical path; `bindLoadProjectRowLoad` is now the modal-specific wrapper (mutex + row busy UI). The owner-email filter is un-gated to `isAdmin \|\| isOverseer` |
| [features/copy-project.js](features/copy-project.js) | The **copy/fork domain + save-before-load gate**, split out of [features/load-project.js](features/load-project.js) 2026-07-30 at that file's documented domain boundary (the code itself arrived from app.js as registry split #35). Owns `pendingCopyProject` / `copyProjectModalTarget`; binds `#copyProjectModalConfirm` + the `#saveBeforeLoad*` modal buttons at load; registers `App.openCopyProjectModalOrPromptSave`, `App.openLoadProjectModalOrPromptSave`, `App.hydrateProjectFromCloudRow`, `App.resolvePdfBufferForCloudProject`, `App.buildPagesFromPdfArrayBufferAndProjectData`, `App.resetCopyProjectState`, `App.clearCopyProjectModalTarget`. Reads `App.openLoadProjectModal` (registered by load-project.js) at call time, so load order between the two files is irrelevant. Regression: [copy-project.spec.js](copy-project.spec.js). |
| [features/bid-board.js](features/bid-board.js) | The **overseer Bid Board** (`#bidBoardModal`) — the read-only "see every bid" surface for `profiles.is_overseer` users (server side: migrations `profiles_is_overseer` / `list_accessible_projects_overseer` / `overseer_admin`, see SUPABASE_SETUP.md). Renders `list_accessible_projects` rows as presentation-friendly cards (name, estimator = owner-email local part, counts, last-edited, `No PDF` badge) with a search box + estimator `<select>`; a card click funnels into `App.loadCloudProjectRow` (extracted from [features/load-project.js](features/load-project.js)) with `hostModalId: 'bidBoardModal'`, so a bid always opens in the existing viewer mode (`state.isViewer` — overseers have no checkout arm server-side). Registers `App.openBidBoard` (also bound to `#bidBoardBtnSidebar`, shown for overseers **and** admins by `updateUI`) and `App.maybeAutoOpenBidBoard` — called from app.js after the profile flags land at sign-in; auto-opens **once per page load** for pure overseers (never admins) with nothing on screen, deferring to a stored `clickcount-last-project` (the restore-last-session flow) and to view-link tabs. Regression: [bid-board.spec.js](bid-board.spec.js) (stubbed `App.getSupabase`; registry no-op, card render + filters, auto-open guards). Hides the two test-harness accounts' projects (`HIDDEN_TEST_OWNERS`, mirroring cleanup-test-accounts). Review handoff: `review_status === 'ready'` rows render in a pinned **Ready for review** lane (`.bid-board-lane-title`) with a gold badge and — for overseers/admins — a per-card **Mark reviewed** button that calls `App.setProjectReviewStatus(id, 'reviewed')` (registered by [features/review-flow.js](features/review-flow.js)) and re-renders; `'reviewed'` rows carry a quiet ✓ badge. |
| [features/review-flow.js](features/review-flow.js) | The **bid review handoff** (estimator → overseer ops flow; server side: migrations `project_review_flow` / `list_accessible_projects_review`). Registers `App.setProjectReviewStatus(projectId, status)` — the single client entry to the guarded `set_project_review_status` RPC (`'ready'`/clear: owner, editor share, or admin; `'reviewed'`: overseer or admin) — and owns the Project Settings **Bid review** row (`#settingsReviewRow`: live status line + transition button "Mark ready for review" / "Withdraw" / "Mark ready again"). The row re-renders via a MutationObserver on `#settingsModal`'s class each time the modal becomes visible (no app.js hook), fetching `review_status/review_requested_at/reviewed_at` fresh from the projects row; it hides for signed-out/no-project/pure-viewer sessions but never gates harder than the server. Consumed by [features/bid-board.js](features/bid-board.js) (Mark reviewed) and badged in [features/load-project.js](features/load-project.js) rows. Regression: the review-handoff test in [bid-board.spec.js](bid-board.spec.js). |
| [copy-project.spec.js](copy-project.spec.js) | Always-run Playwright regression for the copy/fork split — registry contract (all seven registered names are functions), the not-dirty path (`openCopyProjectModalOrPromptSave` opens `#copyProjectModal` with the "(copy)" name prefilled), the dirty path (opens `#saveBeforeLoadModal` with the copy-specific message; Cancel clears `pendingCopyProject`), and Discard routing back to the copy modal. `npx playwright test copy-project.spec.js` |
| [load-project.spec.js](load-project.spec.js) | Playwright regression for pilot #21 — an always-run registry-contract test (`window.App.openLoadProjectModal` is a function; with Supabase unconfigured the modal shows "Cloud not configured" and becomes visible without throwing), plus a cloud-gated test (`ensureSignedInWithProject`, `test.skip` when no cloud) that opens via `App.openLoadProjectModal()` and asserts `#loadProjectModal.visible` + `#loadProjectList` (or `#loadProjectEmpty`) populated. Asserts no console / page errors; `npx playwright test load-project.spec.js` |
| [features/prepare-pdf.js](features/prepare-pdf.js) | Twenty-second feature-file split (`window.App` registry pilot #22) — the Prepare PDF modal: `openPreparePdfModal` + its preview/nav/render helpers (`renderPreparePdfPreview`, `saveCurrentPageName`, `updatePreparePdfControls`) + `preparePdfRotatePage90` + `commitPreparePdfToState` + `closePreparePdfModal` + the `#preparePdf*` bindings. **T2-15**: the modal's DEFAULT view is a sheet thumbnail **grid** with tap-to-keep/drop + Keep all/none (`renderPreparePdfGrid`, `togglePreparePdfTile`, `setPreparePdfKeptTo`) — dropped sheets stay visible (tap-again restores; grid taps never touch the sheet-view Undo stack); the single-sheet Prev/Next walk survives as the per-tile **zoom** view (`openPreparePdfSheetView` / `#preparePdfBackToGrid`), keeping Rotate/rename/Delete/Undo and the fixed-height letterbox unchanged. Thumbs render lazily (IntersectionObserver + single-flight drain + generation-token cancel on close — the summary-detail pattern) through the publish-only seam `App.rasterPdf` (`renderService.raster`, `kind:'thumb'`, worker-eligible with auto MAIN fallback) into a per-modal `Map` cache keyed `origIdx:rotation` (a zoom-view Rotate invalidates exactly one entry; deliberately NOT the pdf-tile-cache LRU — prepare pages are an uncommitted document). Each commit (Open / Save & Open) logs one `prepare_trim` user-activity event `{total, kept, dropped, mode}`. Its own IIFE loaded **after** [app.js](app.js); the private `preparePdf*` state lets move **with** the feature as module-locals (no setters). Registers `App.openPreparePdfModal`; re-assigns `window.closePreparePdfModal` (inline-HTML/Escape use it) — **Tier-3 B15**: that window name now points at the guarded `requestClosePreparePdfModal`, which `confirm()`s the discard ONLY when trimming/renames/rotations were made since open (`preparePdfHasChanges` vs the `preparePdfOpenSnapshot` captured at open; the commit handlers bypass it via `hideModal`); sheet-view Undo now jumps the preview to the restored sheet; and a signed-out session gets the local title **"Trim your set"** with the Save & Open cloud action hidden (trimming is purely local). The PDF intake pipeline (upload, `loadTestPdf`, hashing) stays in app.js under the renamed `// SECTION: PDF intake (upload, test PDF, hashing)` marker and opens the modal via `App.openPreparePdfModal()`. Nine outer-scope publish-only deps (PDF helpers `assertPdfWithinLimit`/`mergePdfBuffers`/`buildTrimmedPdfBuffer`/`resetGridOrigin` + `rasterPdf` + the Save-and-open flow's `writeTakeoffStateBackup`/`downloadPdfBuffer`/`performSaveProjectToCloud`/`isAuthError`); the `features/*.js` eslint group gained the vendored-lib globals (`pdfjsLib`/`PDFLib`/`jspdf`/`html2canvas`). Interleaved siblings `openCanvasOnlyNeedsPdfModal`/`updateCanvasOnlyNeedsPdfBanner` stay in app.js |
| [prepare-pdf.spec.js](prepare-pdf.spec.js) | Playwright regression for pilot #22 — a real (non-cloud) end-to-end test: loads a small multi-page test PDF, opens via `App.openPreparePdfModal(...)`, asserts `#preparePdfModal` visible with the T2-15 grid as the default view, enters the sheet zoom view per tile, exercises next/prev/rotate/delete, commits, and asserts `state.pages` reflects the kept/trimmed pages. Plus the T2-15 grid cases (tap-to-drop trims the committed set; Keep none disables every commit route until a sheet is kept; sheet-view rename/rotate/delete round-trip to the grid; lazy thumbnails cancel cleanly on close; commit logs `prepare_trim`) and the registry-contract (`window.App.openPreparePdfModal` is a function). Asserts no console / page errors; `npx playwright test prepare-pdf.spec.js` |
| [features/quick-modals.js](features/quick-modals.js) | Twenty-third feature-file split (`window.App` registry pilot #23) — the Quick Count cluster (`populateCounterQuickCountPanel` + icon-tab helpers + `removePlumbingModifier`). The legacy Quick Plumbing `#plumModal` surface (and its `App.populatePlumModal` registration) was **removed 2026-07-30**, and **Tier-3 B17 deleted the dead `#plumBtn` sidebar opener** (with its `.sidebar-plum-row` markup, `#plumLineBtn` twin, viewerHideIds entries, and CSS — the rows shipped `display:none`); the shared modifier store keeps its historical `getPlumbingModifiers` name. Its own IIFE loaded **after** [app.js](app.js); no setters/flag-accessors, no private module state. Two publish-only deps `getPlumbingModifiers`/`savePlumbingModifiers`. Registers `App.populateCounterQuickCountPanel` (registration **moved here from app.js** — `features/counter.js` `showCounterTab('quickcount')` calls it) and `App.updateCounterQuickCountNamePreview` (app.js's shared custom-icon-upload handler refreshes the Quick Count grid via it). Calls back into `App.showCounterTab`; the bidirectional coupling is mediated by the registry. **No-twin create (T2 #16):** the Add handler resolves its color through the private `getCounterQuickCountEffectiveColor(iconPath)` — when the saved default (`plumbingModifiers.defaultColor`, else `COLORS[2]`) would exactly duplicate an existing counter's icon+color, it rotates via the shared `nextUnusedCounterColor` ([recent-colors.js](recent-colors.js), bare global), and the name-preview icon fill + swatch show the color that will actually mint (swatch `title` explains the adjustment). Per-create only — the rotation is never written back to `plumbingModifiers` |
| [quick-modals.spec.js](quick-modals.spec.js) | Playwright regression for pilot #23 — registry-contract (`App.populateCounterQuickCountPanel` + `App.updateCounterQuickCountNamePreview` are functions; the removed legacy surface stays gone: `typeof App.populatePlumModal` is `'undefined'` and `#plumModal` count is 0) plus a real local flow: `App.populateCounterQuickCountPanel()` renders the icon grid without throwing, and `App.showCounterTab('quickcount')` crosses into the feature (asserts the panel populates). Extended for T2 #16 with the "Quick Count no-twin create" describe: seeded icon[0]+`#e8c547` twin → the swatch previews the rotated `COLORS[0]` (WYSIWYG, explanatory title) and Add mints it with distinct sidebar fills; a deliberately distinct icon keeps the default color; a "+"-prompt custom type still rotates; `plumbingModifiers.defaultColor` never rewritten. Asserts no console / page errors; `npx playwright test quick-modals.spec.js` |
| [features/pdf-bundle.js](features/pdf-bundle.js) | Twenty-fourth feature-file split (`window.App` registry pilot #24) — the PDF-bundling helpers `addReportPagesToPdf`/`addNotesToPdf`/`addHighlightsToPdf`/`hasAnyHighlights`/`hasAnyNotes` (report/notes/highlights → jsPDF). Its own IIFE loaded **after** [app.js](app.js). These were **already all on `App`** (publish-only for [features/export-pdfs.js](features/export-pdfs.js)), so the split **re-homes** their registrations from app.js; export-pdfs.js keeps working via `App.*`. One new publish-only dep `wrapNoteText`; `renderAnnotationsToContext`/`getPageCanvases`/`getActiveAnnotations` already on `App`; `buildReportHtml` (report.js) + `html2canvas` (CDN) are runtime globals (added `buildReportHtml` to the `features/*.js` eslint globals). app.js's 6 internal callers convert to `App.*`; the interleaved `importCanvasAfterPdf`/`clearPage` modals stay. **Tier-3 B5 pagination (J10, invisible output fix)**: `addReportPagesToPdf` measures the report DOM's keep-together bands (`tr`/`h1`/`h2` rects → canvas px) before rasterizing and slices the tall raster via the pure `computeReportSliceBounds(totalH, pageH, keepRanges)` (on `App`) — a cut landing inside a band snaps up to the band's top so the whole row lands on the next page (bands taller than a page are ignored; forward progress guaranteed); per-run diagnostics `{ totalH, pageHeightPx, keepRanges, slices }` are published behind the getter `App.getLastReportPagination()` (reassigned each run — registry getter rule) for the spec. `addNotesToPdf` renders the notes section on **uniform A4 portrait pages** (the crop scales down to fit the content box above the wrapped note text via `doc.getTextDimensions`; summary rows paginate at the page bottom) and **folds the Notes Summary onto the first notes page** — the first note renders beneath the summary table when it fits, instead of the summary holding a mostly-empty page. Highlights pages unchanged |
| [pdf-bundle.spec.js](pdf-bundle.spec.js) | Playwright regression for pilot #24 — registry-contract (the 5 bundling fns are functions on `App`) plus a light real check: with a PDF loaded, `App.hasAnyHighlights()`/`hasAnyNotes()` are false, then flip true after a highlight/note is added. Extended for Tier-3 B5 with the "pdf-bundle pagination" describe: pure `computeReportSliceBounds` cases (straddling row snaps whole to the next page; no-rows control; short-report single slice; taller-than-page band ignored); a real html2canvas render (70+ seeded counter rows) asserting via `App.getLastReportPagination()` that no slice boundary lands inside a measured row band, with a 2-row control still rendering one page; and a notes run asserted from the generated bytes via pdf-lib (3 notes → 3 uniform-A4 pages, summary + first-note image sharing page 1). Asserts no console / page errors; `npx playwright test pdf-bundle.spec.js` |
| [features/item-details.js](features/item-details.js) | Twenty-fifth feature-file split (`window.App` registry pilot #25) — the Counter / Line Type **details modal** (`#counterLineTypeDetailsModal`: rename, color, icon grid, per-page usage jump list, delete with `#deleteCounterLineTypeConfirmModal` confirm via the private `performDeleteCounterLineType`), the **Line Properties modal** (`#linePropertiesModal`: name/color/drops ±1/±10/clear + per-drop units, polyline vertex-edit entry), and **`deleteGroup`** (registration **re-homed** from app.js's registry tail — [features/groups.js](features/groups.js) keeps consuming `App.deleteGroup` at call time). The three modal-state flags (`counterLineTypeDetailsItem`, `pendingDeleteCounterLineType`, `pendingLineProperties`) move as private `let`s; the close/confirm bindings move from the zone & page-action handler block. Two core hooks: `hideModal('counterLineTypeDetailsModal')` resets the flag via the `App.onCounterLineTypeDetailsHidden` callback (Groups pattern), and the shared custom-icon upload handler reads the open item via the **feature-registered getter** `App.getCounterLineTypeDetailsItem()`. Registers `App.openCounterLineTypeDetailsModal`/`App.openLinePropertiesModal`/`App.closeLinePropertiesModal`/`App.deleteGroup`. Two new publish-only deps `enterEditMode`/`countItemsInGroup`; reuses `state`/`TOOL`/`showModal`/`hideModal`/`pushUndoSnapshot`/`markProjectDirty`/`updateUI`/`renderPdf`/`getOrderedIcons`/`getEffectiveCustomIcons`/`iconVbFor`/`getPageCanvases`/`makeAnnotations`/`showLineColorModal`/`getActiveAnnotations`/`getPageScale`/`fitZoom`. `showModal`/`hideModal` **stay** in app.js under the renamed marker `// SECTION: Modal primitives (showModal / hideModal)`; the external callers (sidebar edit pens, lines-list edit/dblclick, context-menu Line Properties, Escape branch) reach the modals via `App.*` |
| [features/output.js](features/output.js) | Twenty-sixth feature-file split (`window.App` registry pilot #26) — the **output-actions cluster** (the "Output" features): **Copy to PipeTooling** (`#forPipeTooling` dropdown toggle + `doCopyPipeTooling` with the view-link footer + the by-unit Copied detail line `#pipeToolingCopiedDetail` via `setCopiedDetail` — counts / ft / px from report.js `summarizeToolingExport` + the prefetched export view-link cache `exportViewLinkUrl`/`exportViewLinkProjectId` + `canExportViewLink`/`prefetchExportViewLink`, gated by the **pre-export scale check** `collectUnscaledLinePages`/`runGatedCopy` + `#toolingScaleCheckModal` with its `pendingToolingExport` stash, the `App.onToolingScaleCheckHidden` hide callback, and the Tier-3 B3 Set-scale resume: `resumeToolingExport` + the interactive `#copyAgainModal` "Copy again" toast, fired via the `App.onScaleApplied` callback features/scale.js invokes on every scale commit), **Copy Summary** (`#copySummaryText` dropdown + `doCopyEmailSummary`), and **Download current page** (`downloadCurrentPageAsPdf` + `#downloadCurrentPageBtn` + its mode menu). B3 also: both copy buttons skip their scope drop-up at 1 page / 1 canvas (`isSingleScope`, the Download pattern), the two copy drop-ups anchor to their buttons (`right:auto`) and close each other (`closeScopeMenu`), and clipboard failures alert in plain words (`showCopyFailed`). No entry points registered — the bindings move with their DOM elements, so the mobile burger menu's dispatched clicks keep working untouched; the registrations are the `App.onViewLinkRevoked()` callback (the Share modal's revoke clears the private cache through it) and `App.onScaleApplied`. Two new publish-only deps `SUPABASE_ENABLED`/`getOrCreateViewLinkUrl` (the view-link minting **stays** in app.js — the header Share button uses it too — under the renamed marker `// SECTION: View-link URL helpers & show-highlights/notes`); reuses `state`/`getSupabase()`/`showToast`/`showModal`/`hideModal`/`sanitizeForFilename`/`ensureActiveCanvas`/`getPageCanvases`/`renderAnnotationsToContext`/`makeAnnotations`/`logUserEvent` + the `window.*` report fns. The `downloadProjectPdf`/`downloadPdfBuffer` helpers and the header export/report dropdowns stay in app.js (markers renamed `// SECTION: PDF download helpers` and `// SECTION: Export & report dropdown menus`) |
| [output.spec.js](output.spec.js) | Playwright regression for pilot #26 — with clipboard permissions granted: the Copy Summary option writes the email summary to the clipboard + shows the copied modal; the Copy to PipeTooling option writes the tab-delimited summary and shows the "save to include a view link" toast (cloud enabled, no cloud project → no footer); the Download button opens its mode menu on a multi-page project and the this-canvas option yields a real download named `takeoff-page1_*.pdf`; `App.onViewLinkRevoked` is registered. A second test pins the pre-export scale check: an unscaled line page flags in `#toolingScaleCheckModal` (counter-only pages don't), Cancel drops the export, Export anyway copies with the px unit, Set scale jumps to the flagged page and opens the Set Scale modal, and a scale zone around the line passes the check without a page scale. Asserts no console / page errors; `npx playwright test output.spec.js` |
| [features/share-links.js](features/share-links.js) | Twenty-seventh feature-file split (`window.App` registry pilot #27) — the **Share Project modal** (`#shareProjectModal`): the people list (add via the `invite-to-project` Edge Function, role change / remove via `add_project_share`/`remove_project_share`, loaded via `list_users_for_project_invite` + `list_project_shares`) and the **view-links section** (list / create / Copy URL / access log / revoke via the `*_view_link*` RPCs), plus the `#shareViewLinkCreate`/`#shareProjectModalClose`/`#shareProjectAdd` bindings and the collapse toggle (the view-links section starts EXPANDED — B6/J14 — and its "Recipients enter their email (…)" copy is wired to `VIEW_LINK_ALLOWED_DOMAINS` at load via `#shareViewLinksDomains`). Registers `App.openShareProjectModal`. Cloud-coupled: reads the client via `App.getSupabase()` at call time in every handler (client recycle + the accessor only exists when `SUPABASE_ENABLED`); revoke calls `App.onViewLinkRevoked()` ([features/output.js](features/output.js)) — **feature-to-feature coupling mediated entirely by the registry**, load order irrelevant. No new published deps (`getSupabase`/`SUPABASE_URL`/`showModal`/`hideModal`/`showToast`/`state` all pre-existing). The two openers (`#sidebarLogoShare`, `#settingsShareProject`) stay in app.js as deferred `App.*` calls; the shared view-link minting `getOrCreateViewLinkUrl` + the copy-project openers stay under the renamed marker `// SECTION: Share modal pointer & copy-project openers` |
| [share-links.spec.js](share-links.spec.js) | Playwright regression for pilot #27 — always-run registry-contract smoke (the full flow is Supabase-gated): `App.openShareProjectModal` + `App.onViewLinkRevoked` are functions; opening with no cloud project/session is a safe no-op (modal stays hidden); the view-links collapse toggle round-trips; the close binding hides a force-shown modal. Asserts no console / page errors; `npx playwright test share-links.spec.js` |
| [features/import-clear.js](features/import-clear.js) | Twenty-eighth feature-file split (`window.App` registry pilot #28) — the **canvas JSON import** (`#importInput` change handler + the `#importBtn`/`#importBtnSidebar` openers + the import-canvas-after-PDF prompt modal `#importCanvasAfterPdfModal`) and the **Clear Page confirm flow** (`showClearPageModal` + the `#clearPage`/`#clearPageSidebar` openers + the `#clearPageCancel`/`#clearPageConfirm` handlers, consolidated from the zone & page-action handler block). Registers `App.showClearPageModal` (the Project Settings row stays in app.js as a deferred `App.*` call); the other bindings move with their DOM elements. Two new publish-only deps `applyPageAnnotationsFromData` (the shared per-page deserialize funnel — also used by cloud load / view mode / load-annotations) and `getActiveCanvas`; reuses `state`/`ensureGroupColors`/`saveUserCustomIcons`/`reconcileOrphanedCountersAndLineTypes`/`clearUndoStacks`/`markProjectDirty`/`updateUI`/`renderPdf`/`showModal`/`hideModal`/`pushUndoSnapshot`/`makeAnnotations`. The shared **custom-icon upload handler** that shared the old section stays in app.js under the renamed marker `// SECTION: Custom icon upload handler` (icon-domain infrastructure feeding four icon grids across app.js + three feature files). **Tier-3 B2** import feedback: a bad file toasts in-app (naming Export Canvas as the source of a valid .json) instead of the old native `alert('Invalid import file')`, and a page-count-mismatch import toasts "Applied marks to N of M pages — the plan has fewer pages than the export" instead of dropping the extra entries silently |
| [import-clear.spec.js](import-clear.spec.js) | Playwright regression for pilot #28 — Clear Page: the sidebar button opens the confirm naming the active canvas, Cancel preserves the markers, Confirm empties only the current page's active canvas, `App.showClearPageModal` is registered; Import: a JSON file through `#importInput` replaces the palette and `reconcileOrphanedCountersAndLineTypes` re-creates a counter for still-present orphaned markers, a bad file gets the in-app Export-Canvas-pointer toast (no native dialog), a 2-page export onto a 1-page plan gets the "Applied marks to 1 of 2 pages" mismatch toast (and a matching count stays quiet); Visibility: `#clearPageSidebar` hidden before a PDF loads (`body:not(.has-pdf)` gate), visible + live via a real click at desktop width once one is loaded, hidden for viewers (`state.isViewer`), and present inside the mobile hamburger drawer at 375px. Asserts no console / page errors; `npx playwright test import-clear.spec.js` |
| [features/zone-modals.js](features/zone-modals.js) | Twenty-ninth feature-file split (`window.App` registry pilot #29) — the **zone & page-action modal handlers**: the Multiply Zone value modal (`#multiplyZoneModal` cancel + multiplier-input sync + the deferred Apply that creates a zone from `state.pendingMultiplyZone` — keeping Multiply Zone armed with an armed-hint toast, Tier-3 B8 / J6 — or commits a `state.pendingMultiplyZoneEdit`), the Delete Zone confirm (`#deleteZoneModal` cancel/confirm → `App.performDeleteZone`), and the Delete Page confirm (`#deletePageConfirmModal` cancel/confirm → the pending `onDelete`). Like [features/output.js](features/output.js) it registers **no entry points** — every handler is element-bound and all the pending state lives on `state` (the Grid-split pattern: no callbacks needed; the canvas click handlers and page rows that seed the state stay in app.js). One new publish-only dep `performDeleteZone` (the heavy deletion mutation stays in app.js); reuses `state`/`showModal`/`hideModal`/`getActiveAnnotations`/`ensureActiveCanvas`/`pushUndoSnapshot`/`markProjectDirty`/`updateUI`/`renderPdf`/`uid`/`TOOL`. The `#hamburger`/`#sidebarBackdrop` toggles that shared the old section stay under the renamed marker `// SECTION: Sidebar drawer toggles` |
| [features/summary-detail.js](features/summary-detail.js) | The **Summary count-detail modal** (`#summaryCountDetailModal`, Tier-2 split out of the UI-render region) — `openSummaryCountDetailModal(type, id)`: per-page breakdown of one counter (multiply-zone-adjusted counts) or line type (runs + feet), each row with an async pdf.js-rendered thumbnail composited through `renderAnnotationsToContext` at the export marker/line scales. The four `renderSummary` row bindings in app.js call it via deferred `App.*` arrows. New publish-only deps: `getMultiplyZoneForPoint`, `getLineLengthFeetForTotals`, `formatFeet`. Regression: [summary-detail.spec.js](summary-detail.spec.js) |
| [features/restore-last-session.js](features/restore-last-session.js) | The **last-session restore flow** (Tier-2 split) — `doRestoreLastProject` (full session rebuild from a cloud project row or IDB takeoff backup; PDF ladder: IDB blob → cached blob → signed-URL render → storage download with background re-cache), the `#lastSessionRestoreModal` Keep/Discard handlers (Keep defers the Supabase fetch to click time; offline falls back to the IDB backup; inaccessible projects are cleaned up), and the private `pendingRestore`. Boot (app.js init) detects the candidate and hands it over via `App.openLastSessionRestorePrompt({proj,cachedBlob} | {cloudLast})`; `resetLocalSessionState` clears the flag via the defensive `App.onLastSessionRestoreReset`. idb primitives + `pdfjsLib` are classic-script globals; everything else via `App.*` at call time. Regression: [restore-last-session.spec.js](restore-last-session.spec.js) |
| [features/room-sizer.js](features/room-sizer.js) | The **Room Sizer** feature — draw room boxes on the plan, assign each a ceiling height + a Room, get per-room volumetric totals. Owns the Room Box modal (`#roomBoxModal` create/edit: height input parsed via `parseRealWorldLength`, recent-height chips persisted in `recentRoomHeights` localStorage, room choose/create with palette colors cycled from `COLORS`), the Room edit modal (`#roomEditModal` rename/recolor via `App.showLineColorModal` + delete cascade through `#roomDeleteConfirmModal`), the Rooms sidebar section (`#roomsSection`, hidden until the first box exists; box rows jump pages / delete), and `getRoomVolumeTotals({pageIndices?, getAnnotations?})` — consumed by report.js (guarded `window.App` lookup) for the report table + email summary. Registers `openRoomBoxModal` / `openRoomBoxModalForEdit` (called from the app.js `TOOL.ROOM` click/touch/drag branches + `#ctxEditRoomBox`; `openRoomBoxModal` **refuses a ~zero-size rect** — both dims under 6 logical px at the current zoom — so a same-spot click-click/tap-tap mis-click can't open a 0'-0"×0'-0" dialog, T2-10), `renderRoomsList` (called from `updateUI`, deferred), `getRoomVolumeTotals`. New publishes it consumes: `roomBoxDimsFeet` (pure, geometry.js), `getEffectiveScaleForLine`, `getMergedAnnotationsForPage`. The tool itself (TOOL.ROOM two-corner click path + press-drag-release completion, rubber-band preview with live W×L readout, committed-box rendering via the shared `drawRoomBoxesToContext`, hit testing, delete-zone/rotation participation, legend room-volume rows, hotkey V) stays in app.js. Data: `state.rooms[]` `{id,name,color}` + per-canvas `annotations.roomBoxes[]` `{x1,y1,x2,y2,heightFt,roomId,id}`; both ride save/load/export/import/IDB-backup/undo. Regression: [room-sizer.spec.js](room-sizer.spec.js) |
| [zone-modals.spec.js](zone-modals.spec.js) | Playwright regression for pilot #29 — the Multiply Zone Apply creates a zone with the typed multiplier from a pending rect, the edit path updates an existing zone's multiplier, Cancel clears all pending multiply-zone state, and the Delete Zone cancel/confirm bindings behave (cancel clears pending; confirm with nothing pending is a no-op). Delete Page confirm is exercised by [delete-page.spec.js](delete-page.spec.js). Asserts no console / page errors; `npx playwright test zone-modals.spec.js` |
| [rect-drag.spec.js](rect-drag.spec.js) | Playwright regression for the **rect-tool drag gesture** (JOURNEY-MAP Tier-2 #14, T2-10) — on all five rectangle tools (Highlight, Multiply Zone, Scale Zone, Room Sizer, Delete Area) a press-drag-release past the 6px threshold arms corner 1 at the press point and completes the rectangle at the release point through the tool's normal corner-2 click path (dialogs, overlap checks, undo identical to two-click); a sub-threshold press stays a plain click (two-click path unchanged); the aim-loupe coexistence contract holds (hold still 280ms → loupe wins, commits ONE corner, drag machinery inert); a release outside the page completes clamped to the page edge; leaving the canvas mid-drag cancels the whole gesture (no phantom corner). Asserts no console / page errors; `npx playwright test rect-drag.spec.js` |
| [features/burger-menu.js](features/burger-menu.js) | Thirtieth feature-file split (`window.App` registry pilot #30) — the **mobile right-side burger drawer** (`closeBurgerMenu`/`updateBurgerMenu` + the `#headerBurger`/`#rightMenuBackdrop` bindings) and the **desktop header-overflow compact mode** (`updateHeaderCollapsed`/`scheduleHeaderCollapseCheck` + the resize listener + the load-time initial check), moved together because they are one consolidation feature sharing `closeBurgerMenu`. Registers `App.updateBurgerMenu` + `App.scheduleHeaderCollapseCheck`, which `updateUI` invokes **defensively** (`App.fn && App.fn()`) at its tail — a boot-time updateUI before this file loads is a harmless no-op (the load-time check + on-open rebuild cover it). Drawer rows dispatch the click of their CSS-hidden source control and clone its `<svg>`, so no deeper app.js functions are referenced; deps are just `state` + `SUPABASE_ENABLED` (both pre-published — zero new deps). Regressions: the pre-existing [mobile-burger-menu.spec.js](mobile-burger-menu.spec.js) + [header-overflow.spec.js](header-overflow.spec.js), which were written for this exact feature |
| [mobile-touch.spec.js](mobile-touch.spec.js) | Playwright regression for the **Tier-3 B9 mobile / touch batch** (J1 J15) — the mobile LEFT drawer (`#hamburger` / `body.sidebar-open`) auto-closes on a tool pick: the drawer tool grid (Move, Note, … — Legend/Grid overlay toggles, section headers and the two picker openers do NOT close it), a Counters-list row **arm** (toggle-off keeps the drawer), and Create Counter (a cancelled picker leaves the drawer open); the header tool strip's `padding-right` keeps the last tool clear of `#headerBurger` at full scroll (390 **and** exactly 768, where Quick Line used to sit untappable under the burger); the coarse-pointer copy swaps under `hasTouch` emulation (status hints "Tap …", tap Set-Scale copy, right-click tooltip suffixes stripped at boot and by the dynamic `withRightClickHint` writer, ⇧Q chips hidden) plus a mouse-context control test proving desktop wording is untouched. Asserts no console / page errors; `npx playwright test mobile-touch.spec.js` |
| [features/canvas-layers.js](features/canvas-layers.js) | Thirty-first feature-file split (`window.App` registry pilot #31; the last candidate named by the original extraction recipe) — the **canvas-layer management UI**: the Add Canvas modal (`#addCanvasModal`, new/duplicate modes; duplicate deep-copies the active layer via the new publish-only dep `App.deepCopyAnnotations`), the Canvas Details modal (`#canvasDetailsModal`, rename-committed on close; the Escape branch in app.js dispatches `#canvasDetailsClose`'s click so the commit lives in one place), the Delete Canvas confirm (→ the private `performDeleteCanvas`, which reactivates the first remaining layer), the footer layers menu (`#canvasLayersBtn`/`#canvasMenu`/`#canvasMenuAdd`), `#addCanvasBtn`, the show-all-canvases peek toggle, and the selective peek chooser (`#canvasPeekMenu` — right-click on `#showAllCanvasesBtn`; a checklist over the page's layers writing `state.peekCanvasIdsByPage`, active layer pinned, tool-context-menu-style dismissal listeners attached only while open, Escape swallowed in capture phase). The three state flags (`pendingAddCanvasMode`/`pendingCanvasEdit`/`pendingDeleteCanvas`) move as private `let`s; the `hideModal` resets go through the `App.onCanvasDetailsHidden`/`App.onDeleteCanvasConfirmHidden` callbacks; the canvas switcher's edit pen (renderCanvasSwitcher, app.js) opens the details modal via `App.openCanvasDetailsModal`. The canvas JSON export (`#exportBtn`) that shared the old section stays in app.js under the renamed marker `// SECTION: Export canvas JSON` |
| [canvas-layers.spec.js](canvas-layers.spec.js) | Playwright regression for pilot #31 — Add creates an empty active layer; duplicate mode deep-copies the seeded layer's markers into a distinct annotations object; rename commits via Done **and** via Escape (same `#canvasDetailsClose` path); the delete confirm names the layer, removes it, and reactivates the first remaining one. Asserts no console / page errors; `npx playwright test canvas-layers.spec.js` (the peek toggle is covered by [show-all-canvases.spec.js](show-all-canvases.spec.js)) |
| [features/my-settings.js](features/my-settings.js) | Thirty-second feature-file split (`window.App` registry pilot #32) — the **My Settings modal** (`#mySettingsModal`), the surface pilot #20 deliberately deferred: `openMySettings` (signed-out falls through to the sign-in wall via `App.openAuthGate('mySettings')` — Tier-3 B7: the wall shows a why-am-I-here line and reopens My Settings after sign-in), the **Artboard** rows (Save/Load via the newly-published engine helpers `App.saveUserAirboard`/`App.fetchUserAirboard`, Export to `artboard-backup.json`, Clear-with-defaults using the newly-published `App.PLUMBING_DEFAULTS`/`App.LINE_DEFAULTS`), the change-password form (`supabase.auth.updateUser` via `App.getSupabase()`), sign-out, close, and the admin Manage-Users/Manage-User/All-Users openers (feature-to-feature: `App.openManageUserModal`/`App.openAllUsersModal` + a dispatched `#manageUsersBtn` click into [features/user-admin.js](features/user-admin.js), whose `#mySettingsMyActivity` binding was already there). Registers `App.openMySettings`; the three openers (`#authBtn` signed-in path, `#sidebarLogoUser`, `#statusBarAuth` — the status-bar link now dispatches `#authBtn` so its signed-out click opens the PLAIN wall) stay in app.js as deferred `App.*` calls. The Airboard engine (`fetchUserAirboard`/`saveUserAirboard`) and the auth sign-in form stay in app.js (markers renamed `// SECTION: My Settings pointer` / `// SECTION: Settings menu actions` / `// SECTION: Auth sign-in form`) |
| [my-settings.spec.js](my-settings.spec.js) | Playwright regression for pilot #32 — always-run: `App.openMySettings` registered; signed-out open falls through to the auth modal; Export artboard yields a real `artboard-backup.json` download; Clear artboard empties the palette + resets active tool state; the close binding hides a force-shown modal. The airboard cloud round-trip and password change stay cloud-gated per convention. Asserts no console / page errors; `npx playwright test my-settings.spec.js` |
| [features/palette-insights.js](features/palette-insights.js) | **My Standards** (`#paletteInsightsModal`, opened from My Settings → Artboard → **My Standards**; Tier-3 B13 unified the old "Analyze My Usage" button / "Palette Insights" title under the one trade name — internal `paletteInsights*` ids kept): cross-project counter / line-type usage via the `user_palette_usage` RPC (server-side aggregation — the client never downloads whole project JSONB blobs), ranked unadded-first, then by project breadth (breadth beats raw volume — one huge bid shouldn't dominate), then placements; the min-projects segmented filter (localStorage-persisted) filters both lists AND drives "Add all shown". One-click **ADDITIVE** adds to the cloud Artboard — a narrow fetch-merge-upsert of only the counters/line_types columns, deliberately NOT `App.saveUserAirboard` (the wholesale save, which would replace the Artboard with the current project's palette). Identity is case-insensitive name matching (counter/line-type ids are `uid()`-scoped per project); adds also land immediately in the open project. Regression: [palette-insights.spec.js](palette-insights.spec.js) |
| [features/user-activity.js](features/user-activity.js) | Thirty-third feature-file split (`window.App` registry pilot #33; the last rung of the modal ladder) — the **admin User Activity modal** (`#userActivityModal`, the raw event log): `openUserActivityModal` (per-user events or the all-users view via raw `fetch()` against `list_user_activity_for_admin`), the Events/Summary view toggle (`list_user_activity_summary_for_admin`), the user-select dropdown (`list_users_for_admin`), the client-side filter over `state.userActivityAllRowsCache`, and the close binding; the `userActivitySelectSuppress` flag moves as a private `let`. The rich per-user **Activity overview** was split out to [features/user-activity-overview.js](features/user-activity-overview.js) 2026-07-30 at this file's documented domain seam (zero shared symbols); `App.openUserActivityModal` re-homes here — [features/user-admin.js](features/user-admin.js) consumes it at call time. Uses the published `SUPABASE_URL`/`SUPABASE_ANON_KEY` + the session token from `App.state` (these calls never used supabase-js). Three new publishes for the format.js helpers it renders with (`filterUserActivityRows`/`renderUserActivityAllUsersTableHtml`/`formatLastSignInUserActivity` — format.js globals are lint-invisible to the features eslint group); the pure formatters themselves stay in [format.js](format.js) |
| [user-activity.spec.js](user-activity.spec.js) | Playwright regression for pilot #33 — always-run: the re-homed `App.openUserActivityModal` is wired; opening without an admin session is a safe no-op; the client-side filter pipeline works against a seeded rows cache (typing filters the rendered table, a non-match shows the no-match message, Clear restores the full table); the close binding hides the modal. The loaders stay cloud-gated per convention. Asserts no console / page errors; `npx playwright test user-activity.spec.js` |
| [features/user-activity-overview.js](features/user-activity-overview.js) | The rich per-user **Activity overview** (`#userActivityOverviewModal`), split out of [features/user-activity.js](features/user-activity.js) 2026-07-30 at that file's documented domain seam (the raw log and the overview shared zero symbols): `openUserActivityOverview` → one `user_activity_detail_for_admin(uuid)` jsonb → summary card + stat tiles + windows + breakdown + a day-grouped, run-collapsed feed, plus the `#uaoClose`/`#mySettingsMyActivity` bindings — not admin-only (the RPC guard is **self-or-admin**; My Settings → My Activity opens it for the signed-in user). Registers `App.openUserActivityOverview`; [features/user-admin.js](features/user-admin.js)'s row buttons consume it at call time, so load order is irrelevant. Regression: [user-activity-overview.spec.js](user-activity-overview.spec.js) |
| [user-activity-overview.spec.js](user-activity-overview.spec.js) | Always-run Playwright regression for the overview split — registry contract, the self-or-admin no-op gate, a full stubbed render (the detail RPC routed: header/tiles/windows/breakdown/empty-timeline placeholder + the close binding), and the My Settings → My Activity route. `npx playwright test user-activity-overview.spec.js` |
| [features/tool-context-menu.js](features/tool-context-menu.js) | **Tool right-click context menus**: right-click on a tool button (or active-item chip) opens the `#toolContextMenu` mini menu with that tool's actions; tools with no settings answer with a toast so the gesture always responds. Centralized from the nine one-off handlers that had accumulated in app.js + features/counter.js. One declarative map (`TOOL_CONTEXT`: buttonId → `[{label, run}]`; header/sidebar twins + chips alias shared lists) is the single source — Move + Measure → "Set / edit scale…" (the shared `SCALE_EDIT_ACTIONS` → `App.openScaleModal` — the resting tool's direct path to review/edit the page scale once it's set, otherwise buried behind the S tool, and the natural fix-it entry for the tool whose readout is wrong when the scale is; the no-plan "Open a plan first." gate lives inside `openScaleModal` itself — Tier-3 B8), Counter → Settings + Add counter, Quick Line/Polyline/chip → Line Type Settings + Add line type, Multiply Zone / Legend / Grid → their Settings modals (Grid via the new `App.openGridSettingsModal`, which opens settings **without** toggling the overlay); `NO_SETTINGS_TOOLS` (Set Scale, Highlight, Scale Zone, Delete Area, Note, Room Sizer, Hide Marks) toast. Dismissal listeners (outside pointerdown / Escape / resize / scroll) attach only while open; **Escape is capture-phase + `stopImmediatePropagation`** so one press closes only the menu, never the modal underneath. ArrowUp/Down cycle the items; the anchor regains focus on Escape. Viewer-gated. Registers only the `App.__toolContextMap` test seam. Desktop + tablet (native contextmenu); phone long-press + burger-drawer wiring is a planned follow-up. Regression: [tool-context-menu.spec.js](tool-context-menu.spec.js) |
| [tool-context-menu.spec.js](tool-context-menu.spec.js) | Always-run Playwright regression — map coverage via the `App.__toolContextMap` seam (wired ids + labels + the toast list), the popover flow (items render, click routes to the target modal and closes the menu, the two-item Counter menu's Add path), Move's and Measure's shared "Set / edit scale…" opening the Set Scale modal without switching the active tool, Grid Settings opening without toggling the overlay, Escape closing only the menu while a modal stays up, outside-click dismissal, the toast fallback, the viewer no-op gate, and default-context-menu suppression. `npx playwright test tool-context-menu.spec.js` |
| [snap-angles.spec.js](snap-angles.spec.js) | Playwright regression for the **`J` 45° snap** — the behavioral counterpart to geometry.test.js's pure-math coverage of `snapLineToAngle`: it drives real mouse clicks through the actual draw path and asserts the **committed** annotation (not just the rubber-band preview) lands on a ray. A ~27° drag commits to exactly 45° (`|dx − dy| < 1e-9`), a ~14° drag stays horizontal with `y2 === y1` **bit-exact** (the guard against a unit-vector implementation reintroducing 6e-17 drift), all four diagonals are reachable from a center anchor, polyline legs snap against the previous vertex (armed dialog-free off the seeded active line type — T2-12), and turning the toggle off restores freehand angles. Angles are read in PDF space off the stored annotation — the canvas transform is uniform scale + translate with no rotation, so a 27° screen drag is a 27° PDF delta and the test never needs the zoom/pan. `npx playwright test snap-angles.spec.js` |
| [polyline-esc.spec.js](polyline-esc.spec.js) | Playwright regression for the **staged polyline Escape** (JOURNEY-MAP Tier-2 #22) — mid-draw, each Escape unwinds ONE clicked vertex (tool stays `TOOL.POLYLINE`, `#polylineFinishBar` stays up, Enter commits exactly the remaining vertices as one polyline); with zero vertices left, Escape exits to Move (draft null, nothing committed, a further Escape is a no-op); and the ladder ordering holds — a visible modal (`chooseLineTypeModal`) eats the Escape and pops no vertex. Console/page-error capture in every test. `npx playwright test polyline-esc.spec.js` |
| [esc-ladder.spec.js](esc-ladder.spec.js) | Playwright regression for the **Tier-3 B1 Escape-ladder additions** (JOURNEY-MAP Tier-3 B1) — `saveStatusModal` (routed through `#saveStatusModalClose` so the tick timer clears) and `lastSessionRestoreModal` close on Esc (the restore prompt via `App.dismissLastSessionRestorePrompt`: the T1-01 pending flag clears so backups resume, but NOTHING is consumed — the offer returns next boot); the five counter dialogs (`counterSettingsModal`, `counterLineTypeDetailsModal`, `deleteCounterLineTypeConfirmModal`, `groupModal`, `groupAssignModal`) close on Esc AND backdrop click without double-closing the surface beneath (delete-confirm over details; groupModal over groupAssignModal — one press/click unwinds one dialog); `paletteInsightsModal` closes before the My Settings modal beneath it; `legendSettingsModal` and `customIconTipsModal` (checked before `counterModal`) close; Esc dismisses the mark `#contextMenu` ONLY (capture-phase mirror of features/tool-context-menu.js — the ladder never sees the press); plus regression guards for the T2-13 counterModal→manageIconsModal hide-then-open chain and the T2-02 staged polyline pop yielding to a visible modal. Console/page-error capture in every test. `npx playwright test esc-ladder.spec.js` |
| [polyline-arm.spec.js](polyline-arm.spec.js) | Playwright regression for the **polyline arm path without the dialog tax** (JOURNEY-MAP Tier-2 #28) — with an active line type, `#polylineBtn`/P arms `TOOL.POLYLINE` immediately (no `#polylineModal`), the draft carries the type's id + color and the auto-name `Polyline N` (`nextPolylineName`, increments across commits), and the committed run groups under its type in the Lines list, never "Unassigned"; with no active type the New Polyline dialog opens as before and Start arms with the select's type; with **zero** line types the dialog shows the "—" select, the picker's `#polylineEmpty` empty-state copy, and a disabled Start whose forced click commits nothing (the `if (!lineTypeId) return` guard); and an in-flight draft is **resumed, never replaced** — a mid-draw P keeps every clicked vertex, as does P after the T1-05 page-switch disarm leaves an orphan draft. Console/page-error capture in every test. `npx playwright test polyline-arm.spec.js` |
| [features/lines-list.js](features/lines-list.js) | The **sidebar Lines section renderer** (`renderLinesList`) — the FIRST split out of the UI Render Functions region, the region the decomposition table above names as the next candidate. Owns: grouping every quick line / polyline by line type, the per-type headers (run count + always-feet totals via `getLineLengthFeetForTotals`/`formatFeet`), the expand/collapse state (`state.linesTypeExpanded`, localStorage-persisted), the lines search filter, per-row length (or closed-polyline **area** via `formatArea`/`polygonArea`) + drop markers, row selection (click selects + jumps to the line's page via `fitZoom`; click again deselects), the color-swatch picker, and the Line Properties openers (edit pen + `onDoubleTapOrDblClick`). Registers `App.renderLinesList`. **updateUI calls it defensively** (`App.renderLinesList && App.renderLinesList()`) since boot-time updateUI precedes feature-file load — an empty Lines section for that instant is harmless (no project yet; burger-menu pattern); the search / show-only handlers call it plainly (user-action time). Five new publish-only deps: `formatArea` + `polygonArea` (geometry.js globals routed through the registry — the pilot-#13 `ptDist` pattern), `pickScaleForLineType`, `getLineRealWorldLengthFeet`, `onDoubleTapOrDblClick`. Zero moved state beyond the function itself. Regression: [lines-list.spec.js](lines-list.spec.js) |
| [lines-list.spec.js](lines-list.spec.js) | Playwright regression for the Lines-list split — registry contract (entry point + the five publish-only deps), then the moved behavior end-to-end on a seeded 2-page takeoff (two named quick lines + a polyline, one type): per-type grouping with `3 lines · 25.00 ft` totals, expand/collapse persisting to `linesTypeExpanded` localStorage, the search input filtering by line name through the real handler, row click selecting + jumping to the line's page, and a second click deselecting. Renders through the real `updateUI()` path, so the defensive hot-path seam is exercised, not just the direct call. Note: the Lines *section* starts minimized (`state.linesListCollapsed`), so the spec expands it before clicking rows. `npx playwright test lines-list.spec.js` |
| [features/pages-list.js](features/pages-list.js) | The **sidebar Pages section renderer** (`renderPagesList` + the private `formatPageTitleStartEnd` start/end truncation) — extracted per the lines-list recipe (defensive updateUI seam, publish-only deps, zero moved state). Rows carry the scale/annotation page-number badge, the canvas-count badge, click-to-navigate, and (editors) the rename/delete affordances via `App.startRename`. Double-click/double-tap rename detection is **delegated to the static `#pagesList` container** (one click listener, module-scope 400ms timer + per-render `renameByPage` closures keyed by `dataset.pageIdx`) so the gesture survives the click-1 `fitZoom`→`updateUI`→`innerHTML=''` rebuild that destroyed the old per-row binding (T2 #27); the badge's single-click rename `stopPropagation`s past it, and viewers get navigation only. New publish-only deps: `App.pageHasAnyAnnotations`, `App.startRename`, `App.exitEditMode`. Registers `App.renderPagesList` (consumed by app.js's `updateUI` defensively and by features/page-settings.js). Regression: [pages-list.spec.js](pages-list.spec.js) |
| [features/sidebar-lists.js](features/sidebar-lists.js) | The **sidebar Counters / Line Types / Groups renderers** (`renderCountersList`, `renderLineTypesList`, `renderGroupsList`, `countItemsInGroup`, private `quickKeyBadgeHtml`) — extracted per the lines-list recipe. Counter/line-type rows keep drag-to-reorder, search filtering, show-only-on-page filtering, cross-page badge totals (counter badges show the multiply-adjusted **with-repeats** total via `App.counterTally` — T2-11, matching Summary/footer/report — with the placed count in the badge's hover `title` when a zone makes them differ; always-feet for line types), swatch/edit openers, and the Quick Key keycap badges; activation still funnels through `App.setActiveCounterType` / `App.setActiveLineType` (the ONE selection path shared with Quick Keys). Registrations re-homed from app.js's registry tail; consumed by quick-keys.js, counter-settings.js, line-type-settings.js, item-details.js and `updateUI` (defensive). Regression: [sidebar-lists.spec.js](sidebar-lists.spec.js) |
| [features/status-bar.js](features/status-bar.js) | The **status-bar / footer-totals cluster**, extracted 2026-07-30 from app.js's Math & Format Helpers region (where it was always misfiled — it is DOM chrome over state + save-engine getters): the footer totals cache (`computeFooterTotals`/`getFooterTotalsCached`/`invalidateFooterTotals`), the status-bar renderer (`updateStatus` — sync dot/square, mode line, tool hints, count/length totals, and the `#statusMeasure` Distance chip: renders in-memory `state.lastMeasure` while it belongs to the current page — the Measure result lives here now, not in a toast; Tier-2 #15; the LINE/POLYLINE hints append a **live feet-inches readout** while a draw is in progress (`liveDrawReadout` — preview-identical 45° snap, arc-aware `App.getLineLengthPdfPts`, scale-zone-honoring `App.getEffectiveScaleForLine`, Measure's `App.formatDistFeetInches` with its `px` fallback; the one-line wrap cache keys/measures on a fixed worst-case placeholder so the growing number never re-runs the layout read or wraps the bar; Tier-2 #21)) — the click-verb hints choose their word live per device (Tier-3 B9 / J15): `App.isCoarsePointer()` picks "Tap …" on touch, "Click …" with a mouse, the Save Status summary-block data (`getCloudSaveSummary`, consumed by [features/save-status.js](features/save-status.js)), and the hot-path save-status bell (`updateSaveStatusIndicator`; the on-demand modal stays in save-status.js). **Signed-out save signal (Tier-3 B11 / J12 J15)**: the signed-out mode line shows the local-save stamp the engine already tracks — "Saved on this device · 4:42 PM" from `getLastLocalBackupAt` — instead of the permanent dash (the IDB backup lands ~1s after every change, so the dash was a false "never saved" signal); bars narrower than 1280px (B10's footer-words threshold) compact the words to "Saved · 4:42 PM" — picked in JS via `window.innerWidth` (the mode is one text node, and a clientWidth read would force layout on this per-mousemove path). `getCloudSaveSummary` signed-out is truthful too: with a local backup it returns green "Saved on this device" Canvas/PDF rows carrying the stamp's clock/ago (the pre-B11 grey "Not signed in to cloud" only remains before any backup exists). app.js keeps same-named thin wrappers for its ~30 call sites and the save-engine ctx entries. New publish-only deps: `formatSaveTime`/`formatSaveTimeParts`/`formatAgo`/`getLastSaveIncludedPdf` plus the engine getter passthroughs (`isSaveInProgress`, `isSavePdfInProgress`, `getSaveProgressMessage`, `wasLastCloudSaveAttemptFailed`, `getLastLocalBackupAt`) |
| [footer-hint.spec.js](footer-hint.spec.js) | Playwright regression for the status-bar tool hint — the one-line-only wrap contract (wide bar shows the hint, borderline width drops it instead of wrapping the actions onto a second row, and the (text @ width) cache key survives resizes), the `#statusMeasure` Distance chip lifecycle (Tier-2 #15: footer chip not a toast, outlives the old 5s timer, follows its sheet across page flips, replaced by a new measure), and the live draw readout (Tier-2 #21: quick-line hint grows a live feet-inches number that tracks the cursor, polyline readout is cumulative, unscaled pages read `px` never feet, and a hint+readout too long for the bar drops as one — the worst-case placeholder key keeps the verdict stable while the cursor moves). `npx playwright test footer-hint.spec.js` |
| [local-save-signal.spec.js](local-save-signal.spec.js) | Playwright regression for the **signed-out save signal** (Tier-3 B11 / J12 J15) — the status-bar mode line shows "Saved on this device · <time>" after the real dirty → 1s-debounce → IDB backup path lands and tracks later backups; narrow desktop bars (<1280px) compact the words to "Saved · <time>" and widening swaps the full words back; signed-in the mode line never shows the stamp (cloudMode branch unchanged — Canvas label + dot titles as before); the Save Status panel signed-out shows green "Saved on this device" Canvas/PDF rows with the `#saveStatusSignedOutHint` "Sign in to sync across devices." line (hidden signed-in), and keeps the grey "Not signed in to cloud" row before any backup exists. `npx playwright test local-save-signal.spec.js` |
| [features/canvas-switcher.js](features/canvas-switcher.js) | The **footer canvas switcher renderer** (`renderCanvasSwitcher`: current-name label, `(n/N)` index, the pills, the layers-dropdown rows, show-all peek-button visibility), extracted 2026-07-30 from app.js's UI Render Functions region per the lines-list recipe — defensive updateUI seam, zero moved state, zero new publish-only deps (everything it reads was already on the registry). Registers `App.renderCanvasSwitcher`; the edit pen keeps opening [features/canvas-layers.js](features/canvas-layers.js)'s details modal via `App.openCanvasDetailsModal`. The peek-button visibility path it renders is exercised by [show-all-canvases.spec.js](show-all-canvases.spec.js) |
| [features/summary-list.js](features/summary-list.js) | The **sidebar Summary section renderer** (`renderSummary`: per-group or flat counter / line-type rollups with multiply-zone-adjusted counts and always-feet lengths; T2-11 — counter rows carry a `"N placed · M with repeats"` hover `title` when a multiply zone makes the two differ, the flat path tallying through `App.counterTally`), extracted 2026-07-30 from app.js's UI Render Functions region per the lines-list recipe — defensive updateUI seam, zero moved state, zero new publish-only deps. Registers `App.renderSummary`; rows open the count-detail modal in [features/summary-detail.js](features/summary-detail.js) via `App.openSummaryCountDetailModal` ([summary-detail.spec.js](summary-detail.spec.js) covers that modal and renders through the real `updateUI()` path) |
| [features/turn-in.js](features/turn-in.js) | The **checkout lifecycle UX**, extracted 2026-07-30 from app.js's `[sync]` Turn In section (the one `[sync]` stretch that was real code rather than engine wrappers): `doTurnInAndHandleResult` (result handling over the engine's staged `doTurnIn` — expired short-circuit, already-released refresh, recovery-modal routing), the shared `doCheckoutCurrentProject` action, the header/sidebar edit-status banner click handler, the Project Settings Check Out / Turn In / Force turn-in buttons, and the force-turn-in notice modal the demoted editor sees (`openForceTurnInNoticeModal`, registered as `App.openForceTurnInNoticeModal`; the engine reaches it via `ctx.notifyForceTurnedIn` with a toast fallback — Stage-5 J17 finding, 2026-08-31). All four functions and every call site were internal to the cluster, so app.js needed no wrappers; the engine keeps the staged release (`App.doTurnIn` passthrough), and the expired-attention flags stay app-side behind the existing accessors (`isCheckoutExpiredAttention`/`setCheckoutExpiredAttention`/`clearCheckoutExpiredAttention`/`isAutoSaveSuspended`/`setLastCheckoutRefreshAt`) |
| [features/quick-keys.js](features/quick-keys.js) | **Quick Keys** — binds the number row (`1`–`9`, `0`) to counters and line types so the user switches what they're placing with a keystroke instead of a trip to the sidebar. Owns the bindings modal (`#quickKeysModal`: ten slot rows, each a keycap + colour swatch + `<select>` of the project's counters/line types + a clear button, plus the `#quickKeysSearch` filter — a name-substring search that refilters all ten dropdowns per keystroke; it lives OUTSIDE `#quickKeysList` so re-renders never steal its focus, a slot's bound item always stays listed/selected even when it doesn't match, the box hides in the empty state, and the filter resets on every open) and its two openers: the desktop status-bar link (`#statusBarQuickKeys`, keypad icon + `keys` left of `macros`; hidden below 769px and re-shown **by ID** in the desktop media query — the house pattern; `.has-icon` deliberately sets no `display` so it can't out-cascade the mobile hide) and the Project Settings row (`#settingsQuickKeys`, the mobile path — the settings modal is reachable everywhere via the sidebar logo). Registers `App.openQuickKeysModal` / `App.triggerQuickKey(slot)` / `App.getQuickKeyLabels()` / `App.QUICK_KEY_SLOTS`. **ONE SELECTION PATH**: a number key does not activate anything itself — it calls `App.setActiveCounterType` / `App.setActiveLineType`, the same functions the sidebar rows call (extracted in app.js for exactly this), so toggle-off semantics, the tool switch, and the pages-section collapse can't drift between the two entry points. Data: `state.numberKeyBindings`, slot → `{kind:'counter'\|'lineType', id}` — per-project (ids are `uid()`-scoped), riding save/load, export/import, and the IDB takeoff backup. Bindings ALSO ride the cloud Artboard (`user_airboard.number_key_bindings`, migration 20260724180000): `seedQuickKeysFromArtboard(raw, {replace})` fills-if-empty on sign-in auto-restore and replaces on the explicit My Settings → Load; `applyProjectQuickKeys(incoming)` is the single funnel for all three project intakes (cloud load / PDF-intake restore / canvas-JSON import) — a payload with bindings replaces and clears the artboard-lineage flag, one without keeps a seeded layout but drops a previous project's; `resetLocalSessionState` wipes unconditionally (it doubles as sign-out hygiene). Artboard export includes bindings; Clear artboard clears them. A binding whose target was deleted resolves stale: it toasts rather than silently no-op'ing, and the id is **retained** so re-creating or re-importing that item revives the slot. Two new publish-only deps (`setActiveCounterType`/`setActiveLineType`); viewer-gated inside `triggerQuickKey`. **Sidebar badges**: bound rows show a keycap badge (`.quick-key-slot-badge`, accent digit on a dark chip echoing the Keyboard Map's lit keys) — `quickKeyBadgeHtml(kind, id)` in app.js's list renderers reads the feature-registered reverse lookup `App.getQuickKeySlotFor(kind, id)` deferred, and the modal's bind/clear handlers refresh both lists live, so the bindings teach themselves during normal work. Regression: [quick-keys.spec.js](quick-keys.spec.js) |
| [quick-keys.spec.js](quick-keys.spec.js) | Playwright regression for Quick Keys (8 tests) — binding through the real status-bar → modal → `<select>` path and asserting `state.numberKeyBindings`; the number row then switching counter/line type with the right tool and toggling off on a second press; **an equivalence test** that a number key and `App.setActiveCounterType` leave byte-identical state (the guard on the one-selection-path claim); the keystrokes it must NOT steal (unbound digits, digits typed into an input, `Ctrl`+digit); a stale binding toasting via `#airboardToastText` while retaining its id and rendering a "deleted" marker; clear-slot; bindings surviving the canvas-JSON import; the Keyboard Map lighting bound digits with their names (`1 — Floor Drain`) while unbound ones stay grey; and the search filter (dropdowns filter live, a bound non-matching item survives selected, typing keeps focus, binding through a filtered list works, and reopening resets the filter). Note: keydown is dispatched on `<body>`, not `document` — the handler's input guard calls `.matches`, which `document` doesn't have. `npx playwright test quick-keys.spec.js` |
| [features/keyboard-map.js](features/keyboard-map.js) | The **Keyboard Map** — the visual companion to the Macros / Keyboard Shortcuts list. **Two hosts** picked by CSS at the 769px breakpoint: desktop renders it INLINE at the top of the Macros modal (`#macrosKeyboardInline`, built once at feature load since the source table is static markup and this script is last in the body); mobile hides that and the "See Keyboard" button (`#macrosSeeKeyboard`) opens the standalone `#keyboardMapModal` (rendered on each open). A "host" is any element wrapping a `.kb-board` + `.kb-caption`, and every function here takes one, so neither path is special-cased; both are built regardless of viewport so crossing the breakpoint needs no rebuild. Registers `App.openKeyboardMapModal` + `App.renderKeyboardMapInline`. Renders a 65%-ANSI keyboard silhouette (5 rows, each 15 width units over a 60-column grid so the 1.25/1.5/1.75/2.25-unit keys land on exact boundaries); keys carrying a shortcut light accent-yellow, modifiers (Shift/Ctrl/Cmd/Alt) get the softer outlined variant, everything else stays the grey silhouette. Hovering (mouse only — a touch "hover" would fire and vanish), tapping, or focusing a lit key names its action in `#keyboardMapCaption`. **The lit keys are DERIVED from the Macros table, not hand-declared**: `collectMacroKeys()` walks `#macrosModal .macros-table`, reading each row's `<kbd>` cells for the keys and the last cell for the action, so adding a shortcut row lights its key automatically and the two surfaces cannot drift (rows with no `<kbd>` — the section headers, the `<th>` row, the em-dash Scale Zone row — drop out on their own). `normalizeKeyToken` maps the table's glyphs/words (`←`, `Cmd`, `Esc`, `Space`, …) onto the board's key ids; single characters normalize to uppercase. A **zero-new-dep** split (only `App.showModal`/`App.hideModal`). Registers `App.openKeyboardMapModal`; the opener + close bindings are element-bound at load. The Escape branch in app.js checks this modal **before** `macrosModal` so one Escape closes the board and leaves the list up. Regression: [keyboard-map.spec.js](keyboard-map.spec.js) |
| [features/view-only.js](features/view-only.js) | The **view-link session**: the email-gated `initViewOnlyMode(viewToken)` boot (fetch via the `get-view-project` Edge Function, offline view-cache fallback, page/annotation hydration, viewer `state` flags), the viewer-scale sharing layer (`shareViewerScale` → the `set-view-scale` Edge Function, with the per-token `view:scale:<token>` localStorage temp fallback via `noteViewerTempScale`/`applyViewerTempScales`), the full-screen gate/failure surface (`#viewLinkDeadScreen` — one branded card, filled per state by the private `showViewGateScreen`: the B6 email-required state when the viewer cancels the email gate ("This plan is shared privately" + an Enter-your-email button that re-enters `initViewOnlyMode` in place, no page reload), and the `showViewLinkFailure` dead-link (no button) / network-failure (Retry = reload) states — never the empty editor), and the owner-side `maybeShowViewerScaleNotice` must-clear notice. Viewer pages get plan-name labels (`projectData.name`, not "document.pdf" — B6/J12 J14); the email-gate placeholder and rejection copy are wired to `VIEW_LINK_ALLOWED_DOMAINS` (fallback clickplumbing.com). Registers `App.initViewOnlyMode` (awaited by app.js boot), `App.shareViewerScale` (consumed by app.js AND features/scale.js, guarded), `App.noteViewerTempScale`, `App.applyViewerTempScales` (a `viewer-scale.spec.js` test seam), `App.maybeShowViewerScaleNotice`, `App.cancelViewLinkEmailPrompt` (lets app.js's global Escape handler cancel the email prompt). Regression: [view-only.spec.js](view-only.spec.js) + [viewer-scale.spec.js](viewer-scale.spec.js) + [rotation-share-roundtrip.spec.js](rotation-share-roundtrip.spec.js). |
| [features/pdf-intake.js](features/pdf-intake.js) | The **PDF upload pipeline**: the `#pdfInput` change handler (size caps, multi-file merge, append mode via Prepare PDF, pending-canvas-load hash matching, the load-annotations prompt, first-upload Prepare handoff), `loadTestPdf` (localhost-only), and `titleFromPdfFilename`. **Tier-3 B2**: a corrupt/unreadable file toasts on BOTH intake paths — `handleFreshUpload` used to die as a silent unhandled rejection (its catch now rolls back this upload's pages/buffer and names the file), and `handleAppendPages` traded its native alert for the same toast. Owns the `pendingImportCanvasAfterPdf` / `pendingAddAdditionalPages` flags; registers `App.loadTestPdf`, `App.titleFromPdfFilename`, `App.setPendingAddAdditionalPages`, `App.resetPdfIntakeFlags`. **Tier-3 B15/B15b**: the fresh-upload Prepare hand-off is the shared `openPrepareForFreshUpload()`; the ⚑ signed-out question was resolved 2026-08-31 (delegated call) as a middle path — signed-out / cloud-disabled fresh uploads of **3+ sheets** auto-open the trim step ("Trim your set", Save & Open hidden), while 1-2 sheet uploads go straight in (nothing to trim, and the J1 cold start stays one action); skipped when the local-backup re-apply restored marks. Full signed-in parity was deliberately not chosen. **Tier-3 B16**: window-level drag-and-drop — file drags are `preventDefault`ed app-wide (a stray drop used to navigate away and replace the app) and dropped PDFs feed the `#pdfInput` dispatcher (identical flags/caps/append semantics; non-PDF drops toast; drops are ignored while a modal is open or in viewer sessions; sidebar-reorder drags carry no `Files` type and pass through). The cold-start hint `#canvasEmptyHint` ("Drop a plan here — or Upload PDF") is markup in app/index.html, toggled by `updateUI` (hidden once pages exist and for view-link sessions). Bidirectional with features/prepare-pdf.js (`App.openPreparePdfModal`) and features/load-project.js (`App.hydrateProjectFromCloudRow`). Regression: [pdf-upload.spec.js](pdf-upload.spec.js) + [add-pdf-pages-canvas-jump.spec.js](add-pdf-pages-canvas-jump.spec.js) (no name-matched spec). |
| [features/save-project.js](features/save-project.js) | The **Save Project modal**: open/prefill with the PDF-size probe ladder (buffer → IDB `pdfCacheGet` → storage `.info`), the Include-PDF toggle pair, and the Save action with the three-tier checkout-expiry preflight (`probeCheckoutLock`) and the stale-cloud-PDF confirm, delegating to `performSaveProjectToCloud`. Registers **nothing** — the zone-modals pattern; every handler moved with its DOM element. Coverage rides [upload-then-save.spec.js](upload-then-save.spec.js) (dev-auth-gated) and [indexeddb-backup.spec.js](indexeddb-backup.spec.js) (no name-matched spec; the expiry preflight is untested). |
| [features/line-color.js](features/line-color.js) | The **shared color-selection service** (registry split #36): `showLineColorModal(currentColor, onApply)` (callback stashed on `state.pendingLineColorApply`), `pushRecentColor` (custom-only recents via the pure `nextRecentColors`, localStorage-persisted), and `setupCreateColorPicker(opts)` (the Presets / custom / Recent picker embedded in the three create surfaces). Consumed by features/item-details.js, counter.js, choose-create-line-type.js, quick-line.js, and app.js — a shared dependency of four feature files, so it must not be merged into any one of them. Reads `COLORS` / `nextRecentColors` as bare constants.js globals (unlike the other feature files). Regression: [create-color-picker.spec.js](create-color-picker.spec.js) (no name-matched spec). |
| [features/custom-icon-upload.js](features/custom-icon-upload.js) | **Custom icon upload** (registry split #37): `parseUploadedSvg` (SVG path/rect/circle/ellipse/line → normalized path icon) + the `#customIconUploadInput` handler that persists the icon (`getUserCustomIcons`/`saveUserCustomIcons`) and refreshes the three custom icon grids (Create Counter, Quick Count, Details). `selectUploadedIcon` makes the success visible (T2-05 #19): it scrolls the new cell into view (`scrollIntoView({ block: 'nearest' })` — the cell appends below the grid's 200px fold) and adds the one-shot `.flash-new` selection-ring pulse (styles.css `icon-cell-flash` keyframes; no removal listener — every upload rebuilds the grid via `innerHTML`, so the class never survives a rerender). Registers nothing; reads two feature-registered members at call time (`App.updateCounterQuickCountNamePreview` from quick-modals.js, `App.getCounterLineTypeDetailsItem` from item-details.js). Persistence side covered by [custom-icon-paths-indexeddb.spec.js](custom-icon-paths-indexeddb.spec.js); the upload path by [custom-icon-upload.spec.js](custom-icon-upload.spec.js) (real FileReader + DOMParser walk via `setInputFiles`; grid refresh + selection + name autofill; the T2-05 in-scroll-window + `.flash-new` assertions; the no-supported-shapes rejection alert). |
| [features/ghost.js](features/ghost.js) | **The Ghost tool** (PROTOTYPE): rubber-band a batch of placed marks into a translucent reference copy ("a typical"), drag it over another part of the sheet, and optionally **Stamp** it down as real counted marks. Owns the capture→place gesture (`handleGhostCanvasClick`, staged `handleGhostEscape`) and the per-ghost right-click menu (`tryOpenGhostMenuAt` — Stamp / Show counts / Show runs / Delete). The model half is pure in annotation-model.js (`captureGhostFromRect`, `ghostCounts`, `ghostBounds`, `translateGhost`, `stampGhostIntoAnnotations`, `ghostIndexAtPoint`); drawing is `drawGhosts` in canvas-draw.js (live overlay ONLY — never the export path, like the grid). Ghosts are a DISTINCT annotation kind (`ann.ghosts[]`, `{ id, label, showCounters, showLines, src }` with src annotation-shaped in absolute PDF-space) so no tally surface can read them; Stamp is the single door to counted marks. App.* deps: state, TOOL, ensureActiveCanvas, getActiveAnnotations, pushUndoSnapshot, markProjectDirty, showToast, placeFixedMenu, renderAnnotations, updateUI, logUserEvent + the six model wrappers. Hotkey G. |
| [ghost.spec.js](ghost.spec.js) | Playwright regression for features/ghost.js: registry contract + G arming, the three-click capture→place gesture leaving every tally untouched (footer text pinned byte-identical), the both-ends capture rule + empty-box refusal, the staged Escape ladder, show/hide toggles gating Stamp, Stamp minting fresh-id real marks with the ghost surviving for the next drop, and the save/load sanitizer roundtrip. |
| [keyboard-map.spec.js](keyboard-map.spec.js) | Playwright regression for the Keyboard Map — the load-bearing test is the **derivation guard**: it walks every `<kbd>` in the Macros table, normalizes it with a mirror of the feature's `normalizeKeyToken`, and asserts each one resolves to a board key that is lit (so a future shortcut row the board can't represent fails CI-adjacent local runs rather than silently going dark). Split by breakpoint: the **desktop** describe (default viewport) asserts the inline board is pre-built and visible on Macros-open with **no second click**, the See Keyboard button and its modal stay out of the way, the tool hotkeys `M/S/C/L/J/P/D/R/H/X/V/N/Z/Q` + Space/Escape/arrows are lit, modifiers are outlined rather than filled, an unmapped key (`G`) is a plain silhouette, and the hover caption names the action (incl. a two-action key); a second desktop test asserts the layout contract — card within the viewport, the **body** (not the card) scrolling, and the board sitting above it. The **mobile** describe (375×812) asserts the inverse visibility, that the button opens the modal on top of the list, that the board scrolls inside `.kb-board-wrap` without the page body overflowing, Escape ordering (board first, then the list), and the close button. Both run the derivation guard against their own host. Filters the gitignored `/config.local.js` 404 like [render-pixels.spec.js](render-pixels.spec.js). `npx playwright test keyboard-map.spec.js` |
| [item-details.spec.js](item-details.spec.js) | Playwright regression for pilot #25 — seeds a counter (markers on 2 pages) + line type + grouped quick line, then drives the moved surface end-to-end: sidebar edit pen opens the details modal (title, per-page usage rows, getter returns the open item), rename persists on blur, the moved close binding resets the item, the delete flow routes confirm-modal → `performDeleteCounterLineType` (counter + all markers gone, both modals hidden), Line Properties opens via the context-menu path and Escape closes it via `App.closeLinePropertiesModal` persisting a just-typed drop, and `App.deleteGroup` clears the group off annotations. Asserts no console / page errors; `npx playwright test item-details.spec.js` |
| [recent-colors.js](recent-colors.js) | The recent-COLOR behavior core, split out of [constants.js](constants.js) 2026-07-30 (behavior, not literals): `RECENT_COLORS_MAX` (12) + pure `nextRecentColors(list, color, presets)` (the recent-color list update shared by the create pickers and the edit color picker — presets skipped, case-insensitive dedupe, newest-first), and pure `nextUnusedCounterColor(counters, palette, current)` (T2 #16/#17 — the first palette color no existing counter uses, else the entry after `current` wrapping / `palette[0]` when `current` is off-palette; the shared no-twin color rotate behind `resolveCounterTwin` in [features/counter.js](features/counter.js) and the Quick Count create in [features/quick-modals.js](features/quick-modals.js)). Classic `<script src>` loaded before app.js; feature files read it bare (the features lint group spreads its exports). Guarded CommonJS footer; tested in [constants.test.js](constants.test.js). |
| [recent-drops.js](recent-drops.js) | The recent line-DROP list core, sibling of [recent-colors.js](recent-colors.js): `RECENT_DROPS_MAX` (5), pure `nextRecentDrops(list, value, unit)` (newest-first, deduped on value+unit, non-positive ignored), and `formatDropLabel(value, unit)`. One device-local store (localStorage `recentDrops`) behind BOTH drop speed surfaces — the Line Properties Recent chips and the Drop tool palette — so they can never offer different size vocabularies. Guarded CommonJS footer; tested in [constants.test.js](constants.test.js). |
| [features/drop-mode.js](features/drop-mode.js) | The **Drop tool** (`TOOL.DROP`, hotkey B): pick a size once, then one click per line end adds that vertical drop — the modal round trip per riser is gone. While armed, every line end renders as a labeled target ring (`drawDropNodesOverlay`, called from `renderAnnotations`); clicks route `handleCanvasClick` → `App.commitDropClick(pdf)` → the pure node model in [annotation-model.js](annotation-model.js) (`collectDropNodes` / `applyDropToNode`), which collapses coincident line ends into ONE node and writes a node's drop to exactly one end — the chain-joint double-count guard. Same size again clears (click-to-toggle); each click is one undo step; snapshot only when a dry-run probe says something will change. The `#dropPanel` palette reuses the Chain-panel idiom (draggable, `dropPanelPos`, closable without leaving the tool, Esc ladder) and lists `state.recentDrops` + a custom value/unit entry committing through `App.pushRecentDrop`. Regression: [drop-mode.spec.js](drop-mode.spec.js). |
| [drop-mode.spec.js](drop-mode.spec.js) | Playwright regression for the Drop tool + the recent-drops surfaces: arm/palette/custom-size flow, one-drop-per-shared-joint, toggle-clear, per-click undo, the Esc ladder, the context-menu "Drop N ft here" repeat row (nearest-end targeting via `ctxTarget.pdf`), the Line Properties Recent chips reading the same store, decimal + ft-in entry storing exactly what the field shows, and the no-op-close-stays-clean contract (not dirty, no undo slot burned). |
| [features/drop-peek.js](features/drop-peek.js) | **Drop-size + counter-name disclosure** (wendi's view-mode requests): with the Move tool, hovering/tapping a drop marker OR a counter marker shows a DOM peek chip (`#dropPeekChip` — line-type name + the drop in its stored unit, or the counter's name + "#N · M on this page" matching the index painted on the marker); a click PINS it, and any pointerdown / wheel / keydown dismisses it (covers pan, zoom, page nav, rotate, undo). Drop hit-tests ride `App.collectDropNodes` (coincident ends = ONE node = one value), counter hits scan `counterMarkers`, nearest target wins; both mirror renderAnnotations' active-vs-merged source pick and are gated to `TOOL.NONE` + `!hideMarks` — so it works for viewers (the handleCanvasClick viewer gate admits NONE). Clicking a counter marker also toggles the **"find this counter" halo** (`state.emphasizedCounterId` → `env.emphasizedCounterId`, drawn in canvas-draw.js as a dark-cased accent ring around EVERY marker of that type; live overlay only): unlike the chip it survives pan/zoom/page flips, clears on background click / same-marker re-click / a different type taking over / the Escape ladder's last rung (app.js). Also owns the **"Drop sizes" toggle** `#dropSizesBtn` (beside `#hideMarksBtn`; mirrored as a burger-drawer row on mobile): flips `state.showDropSizes`, which renderAnnotations passes as `env.showDropSizes` so canvas-draw paints a value chip beside every drop glyph — live overlay only, exports untouched. Button shows only when the project has drops (`App.projectHasAnyDrops`). Persisted per device: `view:dropSizes:<token>` (restored by features/view-only.js) or `clickcount-show-drop-sizes`. app.js hooks: `App.onDropPeekHover` (mousemove tail), `App.onDropPeekClick` (TOOL.NONE click branch), `App.updateDropSizesButton` (updateUI). Regression: [drop-peek.spec.js](drop-peek.spec.js). |
| [drop-peek.spec.js](drop-peek.spec.js) | Playwright regression for the peek chip: a REAL hover over a drop marker shows it (name + value in the drop's own unit, one value at a chain joint) and hover-away hides it; a hover over a counter marker names its counter + "#N · M on this page"; click pins; pointerdown / wheel / keydown each dismiss; the `#dropSizesBtn` toggle appears only once the project has drops, flips state + aria-pressed, persists per device, and survives a reload; no peek while a draw tool is armed or Hide marks is on. |
| [hide-marks.spec.js](hide-marks.spec.js) | Playwright regression for the Hide-marks eye toggle: pixel-level overlay blank/restore, icon swap + aria state, data preserved, hidden state persisting across page nav — plus the **inertness coverage** (T2-03): with marks hidden, a REAL drag at a hidden note/legend moves nothing (the gesture pans the sheet), right-click opens no per-mark menu (`ctxTarget` stays null), dblclick opens no note editor, and the cursor never shows `move`; with marks shown the same drag/right-click/hover work as before (controls). |
| [features/highlight-labels.js](features/highlight-labels.js) | **Named highlights** (wendi's review request): label a highlight and jump back to it. Right-click a highlight → `#ctxNameHighlight` ("Name/Rename highlight…", shown by `showContextMenu`) → `#highlightNameModal` writes `h.label` onto the annotation — drawn by `drawAnnotationsCore` (canvas-draw.js) as a solid tag above the rect's top-left in live + export, and riding save/load + export/import untouched (the appliers pass highlight arrays through whole). The `#highlightPanel` bookmarks panel reuses the Chain/Drop palette idiom (shown while `TOOL.HIGHLIGHT` is armed, draggable via `highlightPanelPos`, Esc ladder: cancel rect → close panel → exit tool): rows list every page's highlights merged across canvas layers (page order, named first); row click = jump to that page (`currentPage` + `fitZoom`, the lines-list pattern), ✎ = name/rename. app.js hooks: `App.onHighlightToolSync` (updateUI), `App.openHighlightPanel` (`#highlightBtn` re-click), `App.isHighlightPanelOpen`/`App.closeHighlightPanel` (Escape branch). The tool's right-click context action ("Highlights panel…", features/tool-context-menu.js) arms the tool + opens the panel. Regression: [highlight-labels.spec.js](highlight-labels.spec.js). |
| [features/twin-badge.js](features/twin-badge.js) | **Digital-twin visibility** (PipeTooling `docs/DIGITAL_TWINS_PLAN.md`, Phase E2 — the CountTooling half). Twins are agent-operated accounts that do real takeoffs, so the program's review loop depends on a twin never reading as a person. Two surfaces: (1) the signed-in twin's own chrome banner (`renderTwinBanner`, driven from `state.isDigitalTwin` — read from `profiles.is_digital_twin` alongside `is_admin` at all four auth sites in app.js — and called from `updateUI`; sets `body.twin-session`, which shortens `.app` by the 28px banner height so the fixed-viewport shell is not clipped); (2) badges on every surface that names somebody ELSE — the checkout holder (header edit status + status bar + [features/load-project.js](features/load-project.js) + [features/manage-projects.js](features/manage-projects.js) + [features/turn-in.js](features/turn-in.js)), project shares ([features/share-links.js](features/share-links.js)), project owners (Manage Projects meta + the Load Project admin owner filter), the share/User Activity pickers ([features/user-activity.js](features/user-activity.js) + [features/user-activity-overview.js](features/user-activity-overview.js)), and the admin user list ([features/user-admin.js](features/user-admin.js)). Identifying another user has **two** sources and `isTwinUser` ORs them: an explicit `is_digital_twin` on the row (the admin list only — added to `list_users_for_admin()` and to the `admin-list-users` fallback), and the fleet email pattern `twin-<role>-<n>@twins.counttooling.local` everywhere else, since checkout/share rows carry only an email. The role segment is left open rather than pinned to `estimator` so a later role rollout does not silently stop badging. Registers `App.isTwinEmail`, `App.isTwinUser`, `App.twinBadgeHtml` (innerHTML surfaces), `App.twinEmailText` (textContent surfaces), `App.renderTwinBanner`. Only App.* dep is `App.state`. Regression: [twin-badge.spec.js](twin-badge.spec.js). |
| [takeoff-eval.js](takeoff-eval.js) + [supabase/functions/import-takeoff](supabase/functions/import-takeoff/index.ts) | **The agent takeoff door** (Wave 3 of PipeTooling's estimator-twin pipeline; payload contract [TAKEOFF_IMPORT.md](TAKEOFF_IMPORT.md)). `import-takeoff`: twin-only (profiles.is_digital_twin), always the caller's own project, idempotent by (owner, name) — re-import replaces, never duplicates — canvas-only (no PDF; a human attaches/copies the set at review), builds the exact save-engine data shape (single Main canvas per page, palette from the payload, `data.agentImport` provenance), 400s NAME the failing field so agents self-correct. `takeoff-eval.js` (UMD, node-tested in [takeoff-eval.test.js](takeoff-eval.test.js)): `tally`/`diffTakeoffs` — counts per counter NAME, decimal feet per line-type NAME (copy-tooling-feet denomination: unscaled px reported separately, never summed), match/over/under/missing/extra verdicts + summary accuracy — the scoring rail for agent-vs-human takeoffs. |
| [features/rfi-flags.js](features/rfi-flags.js) | **RFI flags** — the CountTooling half of the cross-app RFI loop (PipeTooling `docs/RFI_LOOP_PLAN.md` R2; estimator-twin pipeline Wave 2.2). Convention: a canvas note whose text starts with `RFI:` (case-insensitive, optional space before the colon) is a question for the GC, dropped at the exact ambiguous spot while drawing — human estimators and agent twins share the identical capture gesture, zero CT-side schema. The sidebar **Copy RFI Flags** button (`#copyRfiFlags`, Output cluster next to Copy Summary) collects every such note across ALL pages and ALL canvases into a tab-delimited clipboard list — header `RFI flags\t<project>`, then `p<N> <pageName>[ · <canvas>]\t<question>` rows (the canvas label appears only on multi-canvas pages, where it disambiguates) — that pastes into PipeTooling's RFI queue, the same clipboard seam Copy to /Tooling uses for counts. Empty case alerts instead of copying. Registers `App.collectRfiFlags` / `App.buildRfiFlagsText` / `App.copyRfiFlags`; deps read at call time: `state`, `showToast`, `logUserEvent` (best-effort). Regression: [rfi-flags.spec.js](rfi-flags.spec.js). |
| [features/notes-ledger.js](features/notes-ledger.js) | **Notes ledger** — numbered pins + header drawer + RFI lifecycle (2026-08-30; built after twin takeoffs buried P201 under plan-space note paragraphs). Notes render as small numbered canvas pins (red = `RFI:`, gray = note, hollow = resolved) instead of plan-space text blocks; display mode per device (`ct:notesDisplay`: `auto` pins RFIs / `detail`-bearing / ≥100-char notes, `text`, `pins`). The pin draw lives in canvas-draw.js behind the live-only `env.notePin` seam (export/print keep full text; app.js builds the per-render pin map via `App.getNotesPinMap`); pin hit-testing is a circle in `getAnnotationAt`. Hover shows a client-space chip (`#notePeekChip`, drop-peek dismissal rules). The header `#notesLedgerBtn` (badge = open RFI count) opens `#notesLedgerDrawer`: every note grouped by page, filters all/RFI/open, row click jumps (page switch + pan centered + chip pinned briefly), resolved checkbox + inline RFI answer editor (saving an answer marks resolved) — both undo-snapshotted project data. Note schema additions (optional, back-compat): `resolved`, `answer`, `detail` (long body imported by import-takeoff; `kind` is derived, never stored). Registers `App.noteKind/noteTitle/isPinNote/notePinInfo/getNotesPinMap/collectNotesLedger/getNotesDisplayMode/setNotesDisplayMode/openNotesLedger/closeNotesLedger/onNotesLedgerSync` (the last re-synced from `updateUI`, same seam as `onHeaderMoreSync`). Deps at call time: `state`, `renderPdf`, `updateUI`, `renderAnnotations`, `pushUndoSnapshot`, `markProjectDirty`, `copyRfiFlags`, `logUserEvent`. Regression: [notes-ledger.spec.js](notes-ledger.spec.js). |
| [features/auth-magic-link.js](features/auth-magic-link.js) | **Email sign-in fallback**: after two failed password attempts on the SAME email, the Sign In modal reveals an offer block — “Email me a sign-in link” — that sends a magic link via `signInWithOtp` with **`shouldCreateUser: false`** (PipeTooling is the system of record; a typo'd email must never provision a CT-only account) and `emailRedirectTo` `/app/` (allowlisted). Link consumption is the stock `detectSessionInUrl` + `onAuthStateChange` path twin-login's mints already exercise — this file owns only the modal UX: TWO entry points sharing one send path — the always-visible quiet link under the actions (“No password? Email me a sign-in link” — PT-provisioned accounts are born with unusable random passwords, so the link IS their sign-in; it yields whenever the offer box is up, never both at once) and the failure-gated offer box (per-email counter, app.js's submit handler reports via `App.onAuthSignInFailed(email)`; per-email so a typo'd address's failures don't qualify the corrected one) — plus the “Check your email” sent state with the open-on-THIS-device warning and a 60s resend cooldown, and reset on modal close (`App.onAuthMagicLinkReset` from the hideModal ladder — the groups.js precedent) or successful sign-in. OTP errors surface honestly but translated (`friendlyOtpError`: “Signups not allowed for otp” → no-account-ask-your-admin; rate limit and ban get plain words; enumeration-hardening traded away for an invite-only tool). App.* deps: `getSupabase`. Regression: [auth-magic-link.spec.js](auth-magic-link.spec.js) (5 tests, GoTrue endpoints stubbed via routes — always run). |
| [auth-wall.spec.js](auth-wall.spec.js) | Playwright regression for the Sign-In wall copy & gate intents (Tier-3 B7, J13 J16 J17): the static `#authWallHelp` office-admin + phone lines; `#authGateLine` shown only for gated openers (`App.openAuthGate` — User Settings / Project Settings > Save / Load Project) and cleared by Cancel/Escape or a plain open; reopen-after-sign-in (stubbed GoTrue password grant + a blanket `rest/v1` stub, the auth-magic-link.spec route pattern); fetch exceptions rendered as plain words while server messages pass through; and the rewritten admin modal copy (Add User heading/subtitle, Manage Users subtitle, the de-duplicated Activity log / Activity overview headings). Always runs — no cloud needed; `npx playwright test auth-wall.spec.js` |
| [highlight-labels.spec.js](highlight-labels.spec.js) | Playwright regression for named highlights: the bookmarks panel appears when the tool is armed and lists seeded highlights across pages (unnamed count in the foot); a REAL right-click on a highlight offers "Name highlight…", the modal's Enter/Save writes `h.label`, the label paints ink, the panel re-sorts named-first and the same right-click now reads "Rename highlight…"; a row click jumps to the row's page; the context-menu name row echoes the label; and the Esc ladder (close panel → exit tool) + re-click-reopens contract. |
| [scripts/build-toc.js](scripts/build-toc.js) | Node script (no deps) that regenerates the line-numbered section index in this file from the `// SECTION:` markers in [app.js](app.js), writing between the BEGIN/END SECTION TOC markers; `npm run build:toc` rewrites in place, `node scripts/build-toc.js --check` exits non-zero when stale. Refuses to run while [app.js](app.js) or this file holds an unresolved git conflict marker (`assertNoConflictMarkers` from [scripts/lib/markers.js](scripts/lib/markers.js) — see the build-sw bullet in PWA/offline for the incident) |
| [scripts/build-filemap.js](scripts/build-filemap.js) | Node script (no deps) that restamps the "Large-file map" table above: each row's Lines cell, the `features/*.js (NN files) \| total` aggregate, and the caption date (only when a count moved, so `--check` is deterministic day to day). Generator owns the numbers; humans own which files are listed and the Status/verdict prose — a hand-added row gets its count kept fresh. Refuses to run while this file or any counted file holds an unresolved git conflict marker ([scripts/lib/markers.js](scripts/lib/markers.js) guard — markers would both corrupt the splice and inflate the counts). `npm run build:filemap`; `--check` in `npm run check` |
| [scripts/build-macros.js](scripts/build-macros.js) | Node script that renders the Macros (Keyboard Shortcuts) table rows in [app/index.html](app/index.html) between generated markers from the `HOTKEYS` table in [constants.js](constants.js) — the same single source the keydown handler executes, so handler/list/Keyboard-Map can't drift (the V-row bug class). Row icons declared `{btn: id}` are extracted LIVE from that element's SVG (missing element/SVG = hard error). Regenerating changes app/index.html, so run `npm run build:sw` after. Refuses to run while [app/index.html](app/index.html) or [hotkeys.js](hotkeys.js) holds an unresolved git conflict marker ([scripts/lib/markers.js](scripts/lib/markers.js) guard). `npm run build:macros`; `--check` in `npm run check` |
| [scripts/lib/markers.js](scripts/lib/markers.js) + [markers.test.js](markers.test.js) | Shared seam for the committed-artifact generators: `spliceMarkedRegion` (BEGIN/END generated-region splice used by build-toc / build-macros) and `findConflictMarkerLine`/`assertNoConflictMarkers` — the "resolve merge conflicts before stamping" guard build-toc / build-filemap / build-macros / build-sw all run before touching a committed file (why: see the build-sw bullet under PWA/offline). [markers.test.js](markers.test.js) pins both with `node:test`; `npm run test:unit` |
| [hotkeys.spec.js](hotkeys.spec.js) | Playwright regression for hotkeys-as-data — the executable half of the contract (`build:macros --check` gates the rendered half): every non-bespoke `HOTKEYS` entry resolves to a registered runner (`App.__hotkeyRunnerNames`) or a real element, both directions; behavior smoke through the real keydown path (d arms Measure on a scaled page, m resets, j toggles snap); viewer gating riding the table (h no-ops for viewers, d still works); and every runnable key lit on the Keyboard Map end-to-end. `npx playwright test hotkeys.spec.js` |
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

`app.js` is one ~6.5k-line IIFE: `state`, ~50 `let` flags, and ~100 functions
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
`App.showCounterTab` (reached by the Shift+C
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
- L92 - Icon data (icon *_PATH consts, VB_384_512_PATHS, CUSTOM_ICONS) lives in icons.js,
- L136 - ICONS array lives in icons.js (see icon-data note above).
- L186 - State
- L373 - [sync] Sync recovery & client recycle
- L454 - [sync] Global force reload
- L542 - [sync] Save Status log & envelope
- L545 - [sync] Field-error telemetry
- L604 - [sync] Dirty tracking & local session reset
- L610 - Undo/redo stacks
- L751 - [sync] Checkout probe, hashing & PDF cache
- L813 - Math & Format Helpers
- L1242 - Coordinate Helpers
- L1250 - PDF render bitmap cache
- L1304 - Sharp crop tile (deep-zoom sharpening + window-first commits)
- L1315 - PDF Rendering
- L2087 - UI Render Functions
- L2734 - Inline rename & polyline edit mode
- L2848 - Modal primitives (showModal / hideModal)
- L2879 - Toasts & line color picker
- L2947 - Airboard cloud sync
- L2992 - Supabase RPC & presence heartbeat
- L3032 - User activity / event telemetry
- L3091 - Supabase auth & dev auth
- L3277 - [sync] Checkout subscription & permission refresh
- L3287 - Modals & Handlers
- L3355 - PDF intake (upload, test PDF, hashing)
- L3363 - Toolbar tool buttons
- L3563 - Tool sidebar buttons & legend overlay
- L3654 - Add Line Type modal
- L3737 - Line color & sidebar handlers
- L3946 - Polyline modal & drawing
- L3989 - Zoom bar & page navigation
- L4015 - Export canvas JSON
- L4031 - PDF download helpers
- L4040 - View-link URL helpers & show-highlights/notes
- L4112 - Custom icon upload handler
- L4122 - Export & report dropdown menus
- L4209 - Sidebar drawer toggles
- L4240 - Mobile actions burger menu pointer & header logo
- L4252 - User Activity pointer (format.js + features/user-activity.js)
- L4264 - My Settings pointer (features/my-settings.js)
- L4289 - Auth & settings entry buttons
  - L4348 - Project Settings checkout & Save Status bell
  - L4440 - [sync] Checkout expired recovery
  - L4496 - [sync] Turn In
  - L4605 - Share modal pointer & copy-project openers
  - L4636 - Settings menu actions
  - L4657 - Auth sign-in form
  - L4682 - Save Project modal
  - L4695 - Checkout expired recovery modal wiring
  - L4800 - Last-session restore prompt
  - L4807 - Canvas Repair modal wiring
- L4994 - Canvas Event Handlers
- L5461 - Event Binding
- L5471 - Aim loupe (mobile press-hold precise placement)
- L5621 - Zoom transform preview & commit
- L5700 - Canvas mouse, wheel & touch handlers
- L6452 - Global dropdown dismissal & keyboard hotkeys
- L6805 - [sync] Manual save to cloud
- L6815 - [sync] Auto-save
- L6822 - [sync] Local backup (IndexedDB takeoff state)
- L6955 - [sync] Checkout keep-alive
- L6969 - App feature registry
- L7284 - View-only mode
- L7290 - Init / boot

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
- [sync] Field-error telemetry — `reportClientError` + the window `error`/`unhandledrejection` hooks (client_error / client_unhandled_rejection into the saveStatusLog; deduped, capped 10/session)
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
  - Load Project modal (`openLoadProjectModal` + list/filters/access-panels/project-load) → moved to [features/load-project.js](features/load-project.js); the save-before-load gate + copy/fork domain → [features/copy-project.js](features/copy-project.js); the `#loadProject*` bindings stay in app.js
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
| Measure tool / distance chip | `TOOL.MEASURE` or `measureBtn`; result renders in `#statusMeasure` (features/status-bar.js); same-zone uses `getEffectiveScaleForLine` |
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
| Quick Keys (number row) | `numberKeyBindings` or `triggerQuickKey` or `quickKeysModal` (features/quick-keys.js); the shared selection path: `setActiveCounterType` / `setActiveLineType` (app.js) |
| Macros / Keyboard Map | `macrosModal` or `macrosSeeKeyboard`; the board: `openKeyboardMapModal` / `keyboardMapBoard` / `collectMacroKeys` (features/keyboard-map.js) |
| Middle mouse pan | `state.isPanning` or `state.panStart` |
| Show Highlights / Notes | `addHighlightsToPdf` or `addNotesToPdf` or `hasAnyNotes` |
| Note modal | `openNoteModal` |
| Line real-world length / scale zones | `getLineRealWorldLength` or `getLineLengthForTotals` or `getEffectiveScaleForLine` |
| Length tally in feet (always-feet) | `getLineLengthFeetForTotals` or `lineLengthFeetForTotals` (line-metrics.js) or `formatFeet` (geometry.js) |
| Multiply Zone | `TOOL.MULTIPLY_ZONE` or `getMultiplyZoneForPoint` / `getMultiplyZoneForLine` |
| Scale Zone | `TOOL.SCALE_ZONE` or `getScaleZoneForLine` or `scaleModalApplyTarget` |
| Delete Zone | `TOOL.DELETE_ZONE` or `collectItemsToDeleteInRect` or `performDeleteZone` |
| Snap to 45° angles | `lineTypeSnapToHVHeaderBtn` or `snapToHorizontalVertical` (persisted key) or `snapLineToAngle` (geometry.js) |

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
  Counter, Line, Polyline, divider, Snap to 45° when Line/Polyline selected) on
  the left; spacer; cloud import/export control (`#exportDropdown`, 28x28 icons):
  cloud-upload when editor has no pages (click triggers `#pdfInput`),
  cloud-download menu when pages exist (Canvas/Both gated by
  `projectHasAnyCanvasMarkup()`, Export PDF when PDF present, Import Canvas for
  editors — greyed/disabled with an inline "(canvas has marks — clear or undo
  first)" explainer while the project has markup, B12); Copy view link, Save Status bell, settings gear top
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
  project/sync status, footer totals `#statusTotals`, Sign In (Supabase), Macros.
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
- **Set Scale first toasts** — for the gated length tools when no scale; the
  toast's "Set Scale ⚖" words are a real link (`#setScaleFirstLink`) that opens
  the Set Scale dialog (`.toast-interactive` card, 6s timer; Tier-2 #23).
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
- **Polyline arm (T2-12)** — with an active line type, P arms directly (auto-name
  `Polyline N`, the type's color/id; a mid-draw P resumes the in-flight draft,
  never replaces it); the New Polyline dialog is the no-active-type path and
  refuses to start with zero line types (`#polylineEmpty` + disabled Start).
- **Polyline Escape** — each press removes the last clicked vertex; with none
  left, exits to Move.
- **Line selection highlight** — selected line drawn thicker with glow;
  `selectedLineId` / `selectedLinePageIdx`.
- **Line drops** — per-line `startDrop` / `endDrop` (each in its own unit via
  `startDropUnit`/`endDropUnit`) for vertical runs; X markers at endpoints when
  drop > 0; included in totals via `getLineLengthPdfPts`; Line Properties modal
  (`#linePropertiesLineType` shows the source line type) edits Name, Color,
  drops (decimal or ft-in "8'6" entry, ±1/±10/Clear, one-click **Recent
  chips**), polyline vertex edit. Every drop commit funnels through one
  `commitDrop` (snapshot-before-mutate, field echoes the stored value, dirty
  only on real change) and reports `drop_set` telemetry with its route.
- **Drop tool** (`B`) — the fast path for many drops: pick a size in the
  `#dropPanel` palette (recent sizes + custom), then one click per line end;
  coincident ends collapse to one node so a chain joint never counts its
  vertical footage twice; same size again clears. The context menu on any line
  also offers **"Drop N ft here"** (the last-used size, applied to the nearest
  end) so the second-and-later drops never need the modal. See
  [features/drop-mode.js](features/drop-mode.js).
- **Peek chip (drops + counter names) + "Drop sizes" toggle** — reading marks
  back without opening a modal (and the only way in view mode): hover/tap a
  drop marker with the Move tool for a pinned peek chip naming the line type
  and drop, or a counter marker for its counter name + "#N · M on this page";
  flip `#dropSizesBtn` to label every drop glyph on the canvas (live overlay
  only — exports/prints unchanged; per-device persistence). See
  [features/drop-peek.js](features/drop-peek.js).
- **Line types curveStyle** — `'straight'` (default) or `'arc'`; arc quick lines
  render as quadratic Beziers and use arc length for totals; persisted in
  save/load and export/import.
- **Measure tool** (`D`) — two-click distance; the result rides the footer as
  the `#statusMeasure` chip (in-memory `state.lastMeasure`, shown while you stay
  on that sheet — no toast) and uses the enclosing Scale Zone's scale when both
  clicks fall in one zone, else page scale; available in view mode.
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
  The on-zone scale label (the zone's `scale.label`, else the `N unit/pt`
  fallback) is governed by `state.scaleZoneSettings` (show/hide, size 8–24,
  position — default **top-left**, deliberately not center, so the resting label
  never covers the detail being counted); settings modal via right-click on the
  toolbar icon ([features/scale-zone-settings.js](features/scale-zone-settings.js)).
  Rides save/load + export/import alongside `multiplyZoneSettings`.
- **Delete Zone tool** — two-click rectangle; confirmation modal with counts;
  deletes counters/lines/polylines/highlights/notes/zones whose anchor falls in the
  rect; hidden for viewers.
- **Highlight annotation** (`H`) — two-click low-opacity rectangle;
  `page.annotations.highlights`.
- **Named highlights** (wendi's review request) — right-click a highlight →
  "Name highlight…" writes `h.label` onto the annotation (drawn as a solid tag
  above the rect's top-left in the live overlay AND every export; rides
  save/load + export/import untouched). While the Highlight tool is armed, the
  `#highlightPanel` bookmarks panel (Chain-panel idiom, `highlightPanelPos`)
  lists every page's highlights — named first — as jump-to rows ("Pipe
  material — p6"; click = go to page, ✎ = rename); the tool's right-click
  context action opens the same panel. See
  [features/highlight-labels.js](features/highlight-labels.js).
- **Note annotation** (`N`) — click to place, modal for text; red text; resizable
  width and font size; moveable; double-click or context Edit to edit.
- **Page rotation** (`R`) — per-page `page.rotation` (0/90/180/270); annotations
  and notes transform; persisted.
- **Snap to 45° angles** (`J`) — header toggle (right of Polyline when
  Line/Polyline selected) and Line Type Settings. Constrains quick lines and each
  polyline leg to the nearest of **8** rays — horizontal, vertical, and the four
  45° diagonals (45/135/225/315) — which is what plumbing runs actually do (45°
  fittings are a stock part). Applies to the rubber-band preview and the commit
  alike, on desktop click and the mobile aim loupe, since all five call sites
  funnel through the one pure `snapLineToAngle(x1, y1, x2, y2, stepDeg)` in
  [geometry.js](geometry.js). That helper projects the pointer orthogonally onto
  the chosen ray (so the end still tracks how far along the ray you've dragged)
  using **integer** direction vectors, which keeps axis snaps bit-exact — a
  vertical line gets `x1` unchanged, not `x1 + 6e-17`. It was H/V-only until
  2026-07-23; `stepDeg: 90` still selects that behavior, and the persisted
  setting key stays `snapToHorizontalVertical` (renaming it would orphan saved
  `lineTypeSettings`).

### Counters / line types / sidebar

- **Counter Settings** — click "Counters" heading: icon size, opacity, number
  size, outline, show ring (size, opacity, solid toggle); "Show only counters on
  current page" filter. Ring section only visible when rings on.
- **Line Type Settings** — click "Line Types" heading: opacity, line size, drop X
  size + icon style, orient length with line direction, parallel ends, length
  label size, snap to 45° angles, "show only line types/lines on current page".
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
  explains why. **Pre-export scale check** (`#toolingScaleCheckModal`,
  features/output.js): before the copy, `collectUnscaledLinePages` walks exactly
  the pages/annotations the chosen mode exports and flags pages where a
  summarized line (known `lineTypeId`) has no effective scale
  (`getEffectiveScaleForLine` — page scale or its scale zone's, same
  `pixelsPerUnit` test as the length math's px fallback); pages without line
  marks never flag (counter-only pages pass). On a hit, a confirm modal lists
  the flagged page labels with Cancel / Export anyway (proceeds — the button
  click is the clipboard gesture) / Set scale (jumps to the first flagged page
  and opens the Set Scale modal). Pending export is dropped on any hide via the
  `App.onToolingScaleCheckHidden` callback (hideModal + the Escape branch).
  **Set-scale resume (Tier-3 B3)**: "Set scale" also stashes the interrupted
  copy; every scale commit in features/scale.js fires `App.onScaleApplied`,
  which (while armed, same project) shows the interactive `#copyAgainModal`
  toast — its "Copy again" button re-runs the same gated copy inside the click
  gesture, so `collectUnscaledLinePages` re-walks and the clipboard write stays
  permitted. Also B3: both copy buttons skip the scope drop-up at 1 page /
  1 canvas (every scope is the same set — the Download button's pattern); the
  two copy drop-ups anchor to their buttons (`right:auto` kills the
  stylesheet's `right:0` full-window band) and close each other; and a
  clipboard failure alerts in plain words (raw error to the console only).
- **Copy Summary (Email/Text)** — `#copySummaryTextDropdown`, same canvas options,
  via `getEmailTextSummary`.
- **Show Highlights / Show Notes** — open summaries in a new tab; toggles in the
  Export PDFs modal bundle them into the PDF.
- **Hide marks** — `#hideMarksBtn` (header eye toggle, shown to everyone once a PDF
  is loaded): `toggleHideMarks` flips `state.hideMarks`; `renderAnnotations` sizes +
  clears the overlay then early-returns, so the bare PDF shows through (counters,
  lines, highlights, notes, legend all hide at once — purely visual; the underlying
  data is untouched, and exports/reports use `renderAnnotationsToContext` so they're
  unaffected). Hide-marks also blanks **hit testing** (T2-03): `hitTest`
  early-returns null while hidden, so hidden marks can't be dragged, edited, or
  context-menued — a drag falls through to the normal sheet pan, matching the
  paint. The icon swaps eye ⇄ eye-slash via `updateHideMarksButton` (called
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
  dropdown + sidebar); export gated by `projectHasAnyCanvasMarkup()`. The header
  menu's Import Canvas row disables (grey + inline explainer) instead of hiding
  when markup exists (B12); the burger drawer clones that disabled state.
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
  then draws `getMergedAnnotationsForPage(page, peekIds)` instead of the active
  canvas — the opposite of the hide-marks eye. **Right-click** the button for the
  selective chooser (`#canvasPeekMenu`, features/canvas-layers.js): a checklist of
  the page's layers — the active layer is pinned on, "All canvases" clears the
  selection — stored in `state.peekCanvasIdsByPage` (pageIdx → id array; empty =
  active only, absent = all; a `partial` class dots the button and the title says
  "N of M"). renderCanvasSwitcher prunes ids whose layer was deleted. Purely
  visual: hit testing / editing / exports still target the active canvas only,
  nothing is persisted or marked dirty, and flag + selection auto-clear when the
  page drops back to one layer.
  Regression: [show-all-canvases.spec.js](show-all-canvases.spec.js).

### Editing aids

- **Undo/Redo** — last 50 moves in memory (`UNDO_STACK_SIZE`, constants.js —
  raised from 5 in 2026-07-24 once the high-frequency placement sites moved to
  page-scoped snapshots, O(current page) instead of O(project); the rare
  cross-page cascades still push full snapshots); `undoStack`/`redoStack`; Ctrl+Z /
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
  re-click the zoom %, outside click, or Escape — the rail stays until
  dismissed (B9/J15 removed the old ~5s idle auto-fade).
- **Canvas context menu** — `#contextMenu` on right-click / long-press;
  `handleContextMenu` -> `hitTest` -> `state.ctxTarget`; `#ctxTargetNameRow` shows
  the counter/line-type name below Delete; not available in view mode.
  **Viewport-clamped** via `placeFixedMenu(el, left, top)` (app.js, published as
  `App.placeFixedMenu`; pure core `clampMenuPosition` in geometry.js) — a mark
  near the bottom/right edge pulls the menu up/left instead of opening
  off-screen. The same helper places every fixed popover: the header
  export/report drop-downs, the footer Copy-to-/Tooling / Copy Summary
  drop-ups and Download menu (measured heights, not the old 120px estimate),
  and the canvas layers/peek menus. Regression:
  [menu-clamp.spec.js](menu-clamp.spec.js).
- **Hotkeys** — M/S/C/L/J/P/D/H/X/N/R; Shift+Q open Quick tab (Counter or Choose Line Type modal); arrows:
  Left/Right page nav (Shift = marked-page jump), Up/Down canvas layers; Ctrl+Z /
  Ctrl+Shift+Z; Ctrl+R refresh; ignored while focus is in an input/textarea.
- **Quick Keys** (`1`–`9`, `0`) — the number row binds to counters and line types,
  so switching what you're placing is a keystroke instead of a sidebar trip.
  Bound from the status-bar `keys` link (keypad icon, left of `macros`) →
  `#quickKeysModal`. Pressing a bound key runs the **same** selection path as
  clicking the sidebar row (so a second press deselects); unbound digits are
  no-ops and digits typed into a field are ignored. Bindings are per-project
  (`state.numberKeyBindings`) but follow a user across bids via Save/Load
  Artboard, which preserves counter/line-type ids. Bound digits light up on the
  Keyboard Map with their names. See [features/quick-keys.js](features/quick-keys.js).
- **Macros modal** — Keyboard Shortcuts reference, opened from Project Settings
  or the status-bar `macros` link.
- **Keyboard Map** ([features/keyboard-map.js](features/keyboard-map.js)) — a
  65%-ANSI keyboard silhouette where every key carrying a shortcut lights
  accent-yellow, modifiers are outlined, and unmapped keys stay grey, so a user
  sees the whole mapped surface at a glance instead of reading the list. Hover /
  tap / focus a lit key to name its action underneath. **Two hosts, chosen by CSS
  at the 769px breakpoint** (`.kb-inline` in styles.css): on **desktop** the board
  is rendered **inline at the top of the Macros modal** (`#macrosKeyboardInline`,
  always on screen) and the See Keyboard button is hidden — the card widens to
  660px and becomes a flex column capped at 88vh so the shortcut **table** scrolls
  under a pinned keyboard (modal cards only get a `max-height` on mobile, so
  without that cap the taller card would run off-screen). On **mobile** the inline
  host is hidden and the **See Keyboard** button (`#macrosSeeKeyboard`) opens the
  standalone `#keyboardMapModal`, which stacks **on top of** the Macros modal (one
  Escape closes it and leaves the list up) — a 560px board can't fit a
  phone-width card. Both hosts are built regardless of viewport, so crossing the
  breakpoint needs no rebuild. The lit set is derived from the Macros table
  itself, so the list and the board can never drift.

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
  **Hide marks** header toggle, remembered per token across reloads, and the
  **drop-size peek + "Drop sizes" toggle** (features/drop-peek.js — `view:dropSizes:<token>`,
  restored next to `view:hideMarks`). `initViewOnlyMode`
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
- **CACHE_VERSION + PRECACHE_SHA256 are generated (`npm run build:sw`)** — both blocks in
  [sw.js](sw.js) are stamped by [scripts/build-sw.js](scripts/build-sw.js); never edit them
  by hand. `CACHE_VERSION` is a joint content hash of every asset in `PRECACHE_URLS`;
  `PRECACHE_SHA256` maps each URL to its own full sha256 for the **verified install**:
  `install` fetches every asset with `cache: 'reload'` (origin-fresh, past the HTTP cache),
  hashes it via `crypto.subtle`, and rejects the whole install on any mismatch or non-OK
  fetch. Why: GitHub Pages deploys propagate non-atomically (per-file CDN caches, ~10 min),
  so a visit mid-deploy could fetch a mixed shell — and since `cacheFirst` never
  revalidates, an unverified install would capture that mix into the version-stamped cache
  PERMANENTLY (field report 2026-08: "trouble loading things after a hard reload"). A
  failed install leaves the old SW in control and the browser retries on a later visit
  once the CDN settles; entries verified before the failure are byte-correct for the new
  version and harmlessly re-put on the retry. Browsers without `crypto.subtle` fall back
  to unverified caching. Run `npm run build:sw`
  after changing any precached asset (`npm run check` includes `build:sw -- --check`, so a
  stale stamp fails CI — this replaced the old manual bump, which kept being forgotten).
  `PRECACHE_URLS` itself is still hand-maintained: when adding/renaming a shell file, update
  the app/index.html tag **and** `PRECACHE_URLS`, then rerun `build:sw`.
  **Merge-conflict guard**: before stamping, the script exits non-zero if sw.js or any
  *text* precached source still holds a column-0 git conflict marker
  (`<<<<<<< `/`=======`/`>>>>>>> ` — `assertNoConflictMarkers` in
  [scripts/lib/markers.js](scripts/lib/markers.js), shared with build-toc / build-filemap /
  build-macros; node-tested in [markers.test.js](markers.test.js)). Why: sw.js conflicts on
  nearly every merge (both sides restamp it), and twice an orchestrator regenerated while
  the markers were still in the file — producing a stamped-but-broken sw.js that PASSED
  `build:sw --check` (the hash matched the broken bytes on disk) and only failed at lint.
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

`supabase/migrations/` uses a single Supabase-CLI timestamped scheme,
`YYYYMMDDHHMMSS_label.sql` — the recorded `version` is the timestamp and
matches the filename 1:1. (The legacy `NNN` numbers survive only as labels
embedded in some early filenames, e.g. `20260301171417_001_initial_schema.sql`;
they are human cross-reference, not a second ordering.) Apply in filename
order; see [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for per-migration notes. New
migrations should be applied via the Supabase MCP `apply_migration` tool.

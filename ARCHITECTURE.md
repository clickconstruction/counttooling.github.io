# ClickCount — Code Map for AI Navigation

Use this file to locate code in the app. The HTML shell + every modal live in
[index.html](index.html) (~2.1k lines); the entire app logic (the main JS IIFE)
lives in [app.js](app.js) (~16.2k lines). The core data model and
invariants live in [RECONSTITUTE.md](RECONSTITUTE.md); this file is the
navigation map plus the catalog of features built on top of that core.
Implementation history (e.g. the sync-hardening work) lives in
[CHANGELOG.md](CHANGELOG.md).

> Navigation philosophy: **do not rely on line numbers** — [app.js](app.js)
> is ~16k lines and edits shift them constantly. Navigate by the `// SECTION:`
> markers in the code and by the grep patterns in the Search Hints table below.

## Files

| File | Purpose |
|------|---------|
| [index.html](index.html) | The app shell: HTML structure + every modal; `<head>` loads the CSS/CDN/module scripts, the body ends by loading `app.js` then `report.js`. No inline JS logic anymore (~2.1k lines) |
| [app.js](app.js) | The entire app logic — the former inline `index.html` IIFE, extracted verbatim into a classic `<script src>` (`(function() { … })();`, ~16k lines). Resolves the sibling modules' values by bare name (including the [idb.js](idb.js) storage primitives); exposes its own helpers to `report.js` via `window.*` at the IIFE tail. Linted (`no-undef` as error, the rest of the recommended set as warnings) |
| [styles.css](styles.css) | All CSS (design tokens, layout, modals, sidebar, mobile); linked from `<head>` |
| [icons.js](icons.js) | Bundled icon data — `*_PATH` consts, `VB_384_512_PATHS`, `FA_PATHS`, `RING_PATH`, `CUSTOM_ICONS`, `ICONS`; classic `<script src>` loaded before app.js; values resolve in the shared global lexical scope; guarded CommonJS export footer (`ICONS`, `CUSTOM_ICONS`, `VB_384_512_PATHS`, `FA_PATHS`, `RING_PATH`, `CIRCLE_PATH`, `SCALE_CROSSHAIR_PATH`) so `eslint.config.js` can derive the app.js lint globals |
| [geometry.js](geometry.js) | Pure math/geometry/parse primitives — `ptDist`, `polylineDistance`, `polygonArea`, `distToSegment`, the quadratic-bezier helpers, `rotatePoint90CW`, `pointInRect`, `rectsOverlap`, the zone locators (`getMultiplyZoneForPoint/Line`, `getScaleZoneForLine`), `formatLineLengthRealSum`, `parseRealWorldLength`, `parseFraction`, `formatAgo`, `formatFeetInchesFromVal`; classic `<script src>` loaded before the IIFE; no `state` dependency; has a guarded CommonJS export footer (`if (typeof module !== 'undefined' …)`, inert in the browser) so the primitives can be `require()`d by [geometry.test.js](geometry.test.js) |
| [constants.js](constants.js) | Pure module-level constant literals — `TOOL`, `SCALE_MODES`, `PLUMBING_DEFAULTS`, `LINE_DEFAULTS`, `COLORS`, `SCALE_PRESETS`, the autosave/checkout timing & threshold block, IndexedDB store names + caps, Save Status log windows, checkout messages, and assorted keys/URLs/TZ; classic `<script src>` loaded before the IIFE; no `state`/`window`/icon dependency (env reads like `SUPABASE_*`/`BACKUP_PDF_TO_INDEXEDDB`/`IS_DEV_HOST`, icon-derived consts, and function-local consts stay in app.js); guarded CommonJS export footer so the values can be `require()`d by [constants.test.js](constants.test.js) |
| [geometry.test.js](geometry.test.js) | Node `node:test` + `node:assert` unit tests for the [geometry.js](geometry.js) primitives; run with `npm run test:unit` (no deps). Naming split: `*.test.js` = Node unit tests, `*.spec.js` = Playwright (see `testMatch` in [playwright.config.js](playwright.config.js)) |
| [constants.test.js](constants.test.js) | Node `node:test` invariant tests for [constants.js](constants.js) (backoff arrays increasing & positive, timings/caps > 0, unique enum ids, valid hex colors, positive scale presets); run with `npm run test:unit` |
| [report.js](report.js) | Loads after app.js. Print report, Summary, `getPipeToolingSummary(options)`, `getEmailTextSummary(options)` (both accept `{ pageIndices, getAnnotations }`); `escapeHtml`; consumes globals exposed by app.js via `window.*`. Its `window.*` attachment is guarded by `typeof window` and it has a guarded CommonJS export footer (`escapeHtml`, `pickScaleForLineType`) — both inert in the browser — so those pure helpers can be `require()`d by [report.test.js](report.test.js) |
| [report.test.js](report.test.js) | Node `node:test` unit tests for [report.js](report.js)'s pure helpers — `escapeHtml` (null/undefined → `''`, entity escaping, `&`-first ordering, `String()` coercion) and `pickScaleForLineType` (preferred-unit selection via a `global.state` stub); run with `npm run test:unit` |
| [save-utils.js](save-utils.js) | Pure helpers for the save/sync layer — `isTransientSaveError` (which save/turn-in errors merit one retry) and `getProjectCounts` (counter/line totals over a project `data` object, both legacy `annotations` and `canvases` shapes); classic `<script src>` loaded before the IIFE; no `state`/DOM dependency; guarded CommonJS export footer so the helpers can be `require()`d by [save-utils.test.js](save-utils.test.js) |
| [save-utils.test.js](save-utils.test.js) | Node `node:test` unit tests for [save-utils.js](save-utils.js) (the `isTransientSaveError` transient/non-transient matrix ported from the old localhost `console.assert` block, plus `getProjectCounts` shape/sum cases); run with `npm run test:unit` |
| [idb.js](idb.js) | IndexedDB storage layer extracted from app.js — the single `openPdfCacheDb` (one DB `clickcount-pdf-cache` v5, 8 stores) plus the context-free accessors `viewCache*`, `pdfCache*` (LRU), `takeoffBackupDelete`, `readSaveLogsSnapshots`, and the pure primitives `idbTakeoffBackupGetRaw`, `idbTakeoffBackupPut` (eviction + stale-skip, returns a status), `idbPutSaveLogsSnapshot` (put + prune), `idbCustomIconsGet`/`idbCustomIconsPut`. Classic `<script src>` loaded after [constants.js](constants.js) (whose store-name/cap globals it reads by bare name) and before [app.js](app.js). Depends only on constants + `indexedDB` + args — no `state`/loggers; the state/logging concerns stay in app.js as same-named thin wrappers (`takeoffBackupGet`, `takeoffBackupPut`, `writeSaveLogsSnapshot`, `customIconsGetFromIndexedDB`/`customIconsPutToIndexedDB`). Guarded CommonJS export footer so the primitives can be `require()`d by [idb.test.js](idb.test.js) |
| [idb.test.js](idb.test.js) | Node `node:test` unit tests for [idb.js](idb.js) using `fake-indexeddb` (a fresh `IDBFactory` per test) — pdf-cache hash-mismatch + byte-cap LRU eviction, takeoff-backup round-trip + stale-skip + delete, custom-icon legacy→per-user migration, and save-logs-snapshot prune/newest-first ordering; run with `npm run test:unit` |
| [format.js](format.js) | Pure date/time/text formatters extracted from app.js — `formatLastSignIn`, `dateKeyInTimeZone`, `calendarDaysFromSignInToNowInZone`, `formatLastSignInUserActivity`, `formatUserActivityDateTime`, `filterUserActivityRows`, `renderUserActivityAllUsersTableHtml`. Classic `<script src>` loaded after [constants.js](constants.js) (reads `USER_ACTIVITY_TZ` by bare name) and before [app.js](app.js); no `state`/DOM dependency (the DOM-coupled User Activity modal code — `applyUserActivityFilter`, `populateUserActivityUserSelect` — stays in app.js). Guarded CommonJS export footer so the formatters can be `require()`d by [format.test.js](format.test.js) |
| [format.test.js](format.test.js) | Node `node:test` unit tests for [format.js](format.js) — `calendarDaysFromSignInToNowInZone` integer deltas (incl. year boundary / future), `filterUserActivityRows` match/case rules, `renderUserActivityAllUsersTableHtml` cells + escaping, `formatLastSignIn` relative buckets, `formatUserActivityDateTime`; the two en-CA-hyphen-dependent cases (`dateKeyInTimeZone`, `formatLastSignInUserActivity` Today) auto-skip on a limited-ICU runtime and run on full-ICU (browser-equivalent / CI Node 20); run with `npm run test:unit` |
| [icon-render.js](icon-render.js) | Pure icon geometry / render-rule helpers extracted from app.js — the `CUSTOM_ICON_META` table (derived from `CUSTOM_ICONS`) plus `iconMetaFromList`, `iconViewBoxFromList`, `iconRenderVbRule`, `iconRenderCenterRule`, `iconViewBoxStringRule`, `iconSvgHtml`. Classic `<script src>` loaded after [icons.js](icons.js) (reads `CUSTOM_ICONS`/`VB_384_512_PATHS`/`FA_PATHS` by bare name; the top-level `CUSTOM_ICON_META` read is `typeof`-guarded so Node `require` stays load-safe) and before [app.js](app.js). Depends only on icons.js globals + args — no `state`/DOM/user-icon-cache. app.js keeps the cache-coupled lookups (`getCustomIconMeta`, `getCustomIconViewBox`, `iconRenderVb`, `iconRenderCenter`, `iconViewBoxString`, `renderIconHtml`) as same-named thin wrappers that inject `getEffectiveCustomIcons()`. Guarded CommonJS export footer so the primitives can be `require()`d by [icon-render.test.js](icon-render.test.js) |
| [icon-render.test.js](icon-render.test.js) | Node `node:test` unit tests for [icon-render.js](icon-render.js) — `CUSTOM_ICON_META` derivation, `iconMetaFromList` (built-in fast path / injected user-icon parse / unknown→null), `iconViewBoxFromList`, the three rule functions across an `FA_PATHS` member / a `VB_384_512_PATHS` member / a default path, and `iconSvgHtml` markup + default color; run with `npm run test:unit` |
| [line-metrics.js](line-metrics.js) | Pure line-length / scale math extracted from app.js — `lineSegmentLength` (arc-aware chord), `lineGeomPdfPts`, `lineLengthPdfPts` (adds drop length), `effectiveScaleForLine` (scale-zone override vs page scale), `lineRealWorldLength`, `lineLengthForTotals` (× multiply-zone factor), `scaleForLineType` (unit-preference pick across pages). Classic `<script src>` loaded after [geometry.js](geometry.js) (reads `ptDist`/`polylineDistance`/the bezier helpers/`getScaleZoneForLine`/`getMultiplyZoneForLine` by bare name) and before [app.js](app.js). Depends only on geometry.js globals + args — no `state`. app.js keeps the state-coupled, report.js-facing API (`quickLineLength`, `getLineLengthPdfPts`, `getEffectiveScaleForLine`, `getLineRealWorldLength`, `getLineLengthForTotals`, `pickScaleForLineType`) as same-named thin wrappers that resolve the per-page scale / line-type / pages from `state` and keep their `window.*` exports; the module's function names are deliberately distinct from the wrappers so the app.js-derived globals don't trip `no-redeclare`. Guarded CommonJS export footer so the primitives can be `require()`d by [line-metrics.test.js](line-metrics.test.js) |
| [line-metrics.test.js](line-metrics.test.js) | Node `node:test` unit tests for [line-metrics.js](line-metrics.js) — straight vs arc segment length, polyline summation, drop-length addition (only when scaled), scale-zone override in `effectiveScaleForLine`, real-world length with/without drops, the multiply-zone factor in `lineLengthForTotals`, and `scaleForLineType` unit preference / fallbacks. Sets up the geometry globals via `Object.assign(globalThis, require('./geometry.js'))` before requiring the module; run with `npm run test:unit` |
| [features/canvas-repair.js](features/canvas-repair.js) | First feature-file split of the `app.js` IIFE (the `window.App` registry pilot) — the Canvas Repair modal (`openCanvasRepairModal` + `applyCanvasRepair`). Its own classic-script IIFE loaded **after** [app.js](app.js) (and before [report.js](report.js)); reads shared `state`/helpers from `window.App` at call time and registers `App.openCanvasRepairModal`/`App.applyCanvasRepair` back onto it. app.js invokes them via deferred bindings (`() => App.fn()`). See "Feature files / `window.App` registry" below |
| [canvas-repair.spec.js](canvas-repair.spec.js) | Playwright regression for the registry pilot — uploads `test-2pages.pdf`, adds a page-0 marker, asserts `window.App.openCanvasRepairModal`/`applyCanvasRepair` are functions and `App.state === window.state`, opens the modal + clicks `#canvasRepairApply` (no-op default mapping), and asserts the marker survives with no console / page errors; `npx playwright test canvas-repair.spec.js` |
| [features/note.js](features/note.js) | Second feature-file split (`window.App` registry pilot #2) — the Note add/edit modal (`openNoteModal` + its `noteModalCancel`/`noteModalDone` button bindings). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.openNoteModal`, and binds the modal's Cancel/Done at load. app.js's 5 inbound call sites (canvas click / dblclick / context-menu / touch handlers) call it via `App.openNoteModal(...)` |
| [note.spec.js](note.spec.js) | Playwright regression for pilot #2 — uploads `test-2pages.pdf`, asserts `window.App.openNoteModal`/`ensureActiveCanvas`/`showLineColorModal` are functions, then exercises add (type + `#noteModalDone` persists a note), edit (reopen on the note object, change text), and cancel (`#noteModalCancel` clears `pendingNote`/`editingNote` and adds nothing), reading notes back via `window.App.ensureActiveCanvas`; asserts no console / page errors; `npx playwright test note.spec.js` |
| [features/zoom.js](features/zoom.js) | Third feature-file split (`window.App` registry pilot #3) — the Zoom Settings modal (`showZoomModal` + its `zoomModalClose`/`zoomMax`/`zoomSpeed` handlers). Its own IIFE loaded **after** [app.js](app.js); reads shared `state`/helpers from `window.App` at call time, registers `App.showZoomModal`, binds the modal inputs at load. `getMaxZoom`/`getWheelZoomSpeed` stay defined in app.js (used in ~10 places there) and are read via `App.*` — the first "publish-only, do-not-move" dep. app.js's single call site (the desktop branch of the zoom-% click) calls `App.showZoomModal()` |
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
| [scripts/build-toc.js](scripts/build-toc.js) | Node script (no deps) that regenerates the line-numbered section index in this file from the `// SECTION:` markers in [app.js](app.js), writing between the BEGIN/END SECTION TOC markers; `npm run build:toc` rewrites in place, `node scripts/build-toc.js --check` exits non-zero when stale |
| [eslint.config.js](eslint.config.js) | ESLint v9 flat config for all `.js` (browser modules + Node tooling + `app.js`); `npm run lint`. Enumerates report.js's cross-file project globals as `readonly` so `no-undef`/`no-redeclare` stay on. The `app.js` group auto-derives the sibling modules' exports as `readonly` globals (via `require()`, including [idb.js](idb.js), [format.js](format.js), [icon-render.js](icon-render.js), and [line-metrics.js](line-metrics.js)) and runs the recommended set as warnings with `no-undef` re-raised to error. The constants-only pure-module group (`idb.js` + `format.js`) gets a constants-only global set, [icon-render.js](icon-render.js) gets its own icons-only group (`icons.js` globals), and [line-metrics.js](line-metrics.js) gets a geometry-only group (`geometry.js` globals) — in all cases not their own exports, which would trip `no-redeclare`. A `features/*.js` group lints the registry feature files (browser globals + `module` readonly, `sourceType: 'script'`, `no-undef` error, `no-unused-vars` off since they exist to publish onto `App`). Now that the JS lives in `app.js` (not an inline `<script>`), the whole app is linted |

High level: the `<head>` of [index.html](index.html) loads `config.js`, the CDN
libs (pdf.js, pdf-lib, html2canvas, jsPDF, supabase-js), `styles.css`,
`icons.js`, `icon-render.js`, `geometry.js`, `line-metrics.js`, `constants.js`,
`idb.js`, `format.js`, and `save-utils.js`. The body holds the app shell + every modal,
then loads `app.js` (the main JS IIFE — the bulk of the app logic), then the
feature-file splits (`features/canvas-repair.js`, `features/note.js`,
`features/zoom.js`, `features/manage-icons.js`,
`features/multiply-zone-settings.js`, `features/export-pdfs.js`,
`features/legend-settings.js`, `features/page-settings.js`,
`features/counter-settings.js`, `features/line-type-settings.js`,
`features/choose-create-line-type.js`, `features/scale.js`, `features/groups.js`, `features/grid.js`, `features/quick-line.js`), followed by `report.js`. The CSS, icon data, pure icon-render rules, pure geometry/parse
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

`app.js` is one ~16k-line IIFE: `state`, ~50 `let` flags, and ~100 functions
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
modal → [features/zoom.js](features/zoom.js), the Manage Icons modal →
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
`// SECTION: Add Line Type modal` (rename, not removal, TOC stays 48).

## Section index (grep `// SECTION:`)

The JS in [app.js](app.js) is organized with `// SECTION:` comment markers. The
live list with current `app.js` line numbers is generated by `npm run build:toc`
(run it after adding or moving a `// SECTION:` marker;
`node scripts/build-toc.js --check` fails if stale):

<!-- BEGIN SECTION TOC (generated by scripts/build-toc.js - do not edit by hand) -->

- L2 - Constants
- L53 - Icon data (icon *_PATH consts, VB_384_512_PATHS, CUSTOM_ICONS) lives in icons.js,
- L142 - ICONS array lives in icons.js (see icon-data note above).
- L343 - State
- L571 - Sync recovery & client recycle
- L918 - Global force reload
- L1049 - Save Status log & envelope
- L1134 - Dirty tracking & local session reset
- L1349 - Checkout probe, hashing & PDF cache
- L1596 - Math & Format Helpers
- L2307 - Save Status modal
- L2374 - Coordinate Helpers
- L2386 - PDF Rendering
- L3558 - UI Render Functions
- L5589 - Modals & Handlers
- L5740 - Prepare PDF modal
- L6353 - Toolbar tool buttons
- L6460 - Counter modal
- L6715 - Quick Plumbing / Quick Count modals
- L7158 - Add Line Type modal
- L7230 - Line color & sidebar handlers
- L7374 - Polyline modal & drawing
- L7405 - Zoom bar & page navigation
- L7444 - Canvas layers
- L7647 - PDF download helpers & PipeTooling menu
- L7722 - Copy summaries (PipeTooling / Email)
- L7855 - PDF bundling (report / notes / highlights)
- L8247 - Download current page
- L8495 - Zone & page-action modal handlers
- L8605 - User activity time formatting
- L8763 - User Activity modal (admin)
- L8831 - User Settings & Manage Users
- L9003 - Manage Projects modal
  - L9163 - Project Settings checkout & Save Status bell
  - L9352 - Checkout expired recovery
  - L9606 - Turn In
  - L10108 - Share project & view links
  - L10327 - Cloud project hydrate / copy / fork
  - L10514 - Load Project modal
- L11930 - Canvas Event Handlers
- L12218 - Event Binding
- L12971 - Manual save to cloud
- L13420 - Auto-save
- L13717 - Local backup (IndexedDB takeoff state)
- L13932 - Checkout keep-alive
- L13977 - App feature registry
- L14042 - View-only mode
- L14195 - Init / boot

<!-- END SECTION TOC -->

Annotated, in rough order:

- Constants — `uid`, the `SUPABASE_*`/`supabase` setup, `getLineModifiers`/`getPlumbingModifiers` and friends, and the icon-derived consts (`CUSTOM_ICON_VIEWBOXES`, `CUSTOM_ICON_META`, etc.) stay here. The pure literals `TOOL`, `SCALE_MODES`, `COLORS`, `SCALE_PRESETS`, `PLUMBING_DEFAULTS`, `LINE_DEFAULTS` plus the autosave/checkout timing & threshold block, IndexedDB store names + caps, and assorted keys/URLs/TZ now live in [constants.js](constants.js); the icon path constants, `VB_384_512_PATHS`, `CUSTOM_ICONS`, and `ICONS` live in [icons.js](icons.js)
- State — the `state` object, `makeAnnotations()`, module-level sync/checkout vars and tuning constants, `withTimeout`, `serverNowMs`/`updateServerClockFromRpc`
- Sync recovery & client recycle — `runRecoveryProbe`, `runRecoveryProbeAndMaybeRecycle`, `recreateSupabaseClient`, `rawProjectsUpdate`/`rawProjectsInsert`/`rawCheckInProject`
- Global force reload — `checkGlobalForceReload`, `doGlobalReloadNow`
- Save Status log & envelope — `pushSaveEvent`, `buildSaveLogsEnvelope(WithSnapshots)`, `autosaveEventDetail`, `captureNetworkInfoDetail`
- Dirty tracking & local session reset — `markProjectDirty`, `dirtyGeneration`, `resetLocalSessionState`, `resetAutosaveDegradedState`
- Checkout probe, hashing & PDF cache — `probeCheckoutLock`, `sha256Hex`, `pdfCachePut`/`pdfCacheGet`, takeoff backup IDB helpers
- Math & Format Helpers — the state-coupled helpers: `getPageScale`, `pickScaleForLineType`, `quickLineLength`, `getLineLengthPdfPts`, `getEffectiveScaleForLine`, `getLineRealWorldLength`, `getLineLengthForTotals`, `formatDist`, `formatArea`, `rotateAnnotations` (the pure primitives `ptDist`, `polylineDistance`, `polygonArea`, `distToSegment`, bezier helpers, `pointInRect`, zone locators, `parseFraction`, etc. live in [geometry.js](geometry.js)). The wrappers `formatDistFeetInchesFromReal` / `formatDistFeetInches` keep their `getPageScale` lookup + px fallback then delegate to `formatFeetInchesFromVal`, and `formatSaveTime` / `formatSaveTimeParts` / the `updateStatus` inline delegate to `formatAgo` (both pure helpers live in [geometry.js](geometry.js))
- Save Status modal — `renderSaveStatusModalContent`, `openSaveStatusModal`
- Coordinate Helpers — `getClientCoords`, `canvasRect`, `toCanvas`, `pdfPos`, `canvasToPdf`, `hitTest`, `isPointInPageBounds`
- PDF Rendering — `renderPdf`, `renderAnnotations`, `renderAnnotationsToContext`, `drawDropMarker`, `drawGrid`, `drawLegend`
- UI Render Functions — `updateUI`, `renderPagesList`, `renderCountersList`, `renderLineTypesList`, `renderLinesList`, `renderSummary`, `computeFooterTotals`/`getFooterTotalsCached`
- Modals & Handlers — the big modal/feature region; finer sub-markers below
  - Prepare PDF modal — `openPreparePdfModal`, `commitPreparePdfToState`, `assertPdfWithinLimit`, `mergePdfBuffers`
  - Scale modal — `openScaleModal`, `applyScaleObjectToZoneOrPage`, `resetScaleModalZoneMode`
  - Counter modal — `showCounterTab`, `populateCounterChooseList`
  - Quick Plumbing / Quick Count modals — `populatePlumModal`, `populateCounterQuickCountPanel`
  - Quick Line modal — `populateQuickLineModal`, line modifiers (features/quick-line.js)
  - Groups — `openGroupAssignModal`, group color helpers
  - Multiply Zone settings — `openMultiplyZoneSettingsModal`
  - Zoom modal — `showZoomModal`
  - Canvas layers — `openAddCanvasModal`, `doAddCanvas`, canvas details
  - Export PDFs modal — `openSpecificPagesModal`, `downloadSpecificPages`
  - Copy summaries (PipeTooling / Email) — `doCopyPipeTooling`, `doCopyEmailSummary`
  - PDF bundling (report / notes / highlights) — `addReportPagesToPdf`, `addNotesToPdf`, `addHighlightsToPdf`
  - Download current page — `downloadCurrentPageAsPdf`, `downloadProjectPdf`
  - Note modal — `openNoteModal`
  - User activity time formatting — `formatLastSignIn`, `formatUserActivityDateTime`, `formatLastSignInUserActivity`
  - User Activity modal (admin) — `openUserActivityModal`
  - User Settings & Manage Users — `openMySettings`, `openManageUserModal`, `openAllUsersModal`, `deleteUser`
  - Canvas Repair — `openCanvasRepairModal`, `applyCanvasRepair`
  - Manage Icons modal — `openManageIconsModal`
  - Manage Projects modal — `openManageProjectsModal`, `forceCheckInProjectFromManage`, `deleteProject`
  - Project Settings checkout & Save Status bell — `updateSettingsCheckoutSection`, view-link copy
  - Checkout expired recovery — `applyCheckoutExpiredRecoveryMode`, `openCheckoutExpiredRecoveryModal`, `reCheckOutAfterExpiry`, `tryAutoRecheckoutIfAllowed`
  - Turn In — `doTurnIn`, `doTurnInAndHandleResult`, `tryTurnIn`, `handleEditStatusBannerClick`
  - Share project & view links — `openShareProjectModal`
  - Cloud project hydrate / copy / fork — `hydrateProjectFromCloudRow`, `openCopyProjectModal`, `forkCloudProjectToLocalWorkingCopy`
  - Load Project modal — `openLoadProjectModal`, `renderLoadProjectListRows`, `getFilteredLoadProjects`
- Canvas Event Handlers — `handleCanvasClick`, `handleCanvasDblClick`, `handleContextMenu`, `showContextMenu`
- Event Binding — transform/zoom/pan, wheel, touch, keyboard hotkeys
- Manual save to cloud — `performSaveProjectToCloud`
- Auto-save — `performAutoSave`, `noteAutoSaveOutcome`, `recordAutosaveLatency`
- Local backup (IndexedDB takeoff state) — `writeTakeoffStateBackup`, `writeTakeoffBackupToIndexedDB`
- Checkout keep-alive — `checkoutKeepalive`
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
| Group modals | `groupModal` or `groupAssignModal` or `openGroupAssignModal` |
| Quick Plumbing | `plumModal` or `populatePlumModal` |
| Polyline drawing | `drawingPolyline` or `finishPolyline` |
| Line selection | `selectedLineId` or `selectedLinePageIdx` |
| Canvas click handling | `handleCanvasClick` |
| Measure tool / distance toast | `TOOL.MEASURE` or `measureBtn`; same-zone uses `getEffectiveScaleForLine` |
| Zoom / pan | `state.zoom` or `updateContainerTransform` or `showZoomModal` |
| hitTest | `function hitTest` |
| Context menu | `handleContextMenu` or `showContextMenu` or `ctxTargetNameRow` |
| Coordinate conversion | `canvasToPdf` or `toCanvas` |
| Rename | `startRename` |
| Pages list / collapse / badges | `renderPagesList` or `pagesListCollapsed` or `badge-scale-set` / `badge-has-ann` |
| Download current page | `downloadCurrentPageAsPdf` |
| Export dropdown (cloud up/down) | `exportDropdown` or `projectHasAnyCanvasMarkup` |
| Export Canvas (Advanced + JSON) | `exportBtn` or `advancedExport` |
| Mobile sidebar / header tools | `sidebar-tool-buttons` or `sidebar-triggers` or `has-pdf` |
| Header active type | `headerActiveLineType` or `COUNTER_BTN_DEFAULT_SVG` |
| Toggle switches | `toggle-switch` or `toggle-switch-knob` |
| Bundled icons | `CUSTOM_ICONS` or `getEffectiveCustomIcons`; built via `npm run build:icons` (see [CUSTOM_ICONS.md](CUSTOM_ICONS.md)) |
| Custom icon upload | `customIconUploadInput` or `parseUploadedSvg` or `getUserCustomIcons` |
| Page rotation | `rotatePage90` or `page.rotation` |
| Counter/Line Type details modal | `openCounterLineTypeDetailsModal` |
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
| Admin panel / users | `adminPanelModal` or `openManageUserModal` or `deleteUser` |
| User Activity (admin) | `openUserActivityModal` or `list_user_activity_for_admin` or `USER_ACTIVITY_TZ` |
| Manage Projects | `openManageProjectsModal` or `deleteProject` or `forceCheckInProjectFromManage` |
| Manage Icons | `openManageIconsModal` |
| User Settings / Artboard | `openMySettings` or `mySettingsSaveAirboard` |
| Export PDFs modal | `openSpecificPagesModal` or `downloadSpecificPages` |
| Copy to PipeTooling | `forPipeToolingDropdown` or `getPipeToolingSummary` |
| Copy Summary (Email/Text) | `copySummaryTextDropdown` or `getEmailTextSummary` |
| Summary count detail modal | `openSummaryCountDetailModal` |
| Legend overlay | `showLegendOverlay` or `legendSettingsModal` or `drawLegend` |
| Grid overlay | `showGridOverlay` or `gridSettingsModal` or `drawGrid` or `snapToGrid` |
| Undo / Redo | `undoStack` or `redoStack` or `pushUndoSnapshot` |
| Middle mouse pan | `state.isPanning` or `state.panStart` |
| Show Highlights / Notes | `addHighlightsToPdf` or `addNotesToPdf` or `hasAnyNotes` |
| Note modal | `openNoteModal` |
| Line real-world length / scale zones | `getLineRealWorldLength` or `getLineLengthForTotals` or `getEffectiveScaleForLine` |
| Multiply Zone | `TOOL.MULTIPLY_ZONE` or `getMultiplyZoneForPoint` / `getMultiplyZoneForLine` |
| Scale Zone | `TOOL.SCALE_ZONE` or `getScaleZoneForLine` or `scaleModalApplyTarget` |
| Delete Zone | `TOOL.DELETE_ZONE` or `collectItemsToDeleteInRect` or `performDeleteZone` |
| Snap to H/V | `lineTypeSnapToHVHeaderBtn` or `snapToHorizontalVertical` |

## Key Globals (used by report.js)

These must remain on `window`: `state`, `makeAnnotations`, `ptDist`,
`polylineDistance`, `formatDist`, `renderIconHtml`, `quickLineLength`,
`getLineLengthPdfPts`, `getLineLengthForTotals`, `getLineRealWorldLength`,
`getMultiplyZoneForLine`, `getMultiplyZoneForPoint`, `getEffectiveScaleForLine`,
`getMergedAnnotationsForPage`. [report.js](report.js) exposes back
`buildReportHtml`, `printReport`, `getPipeToolingSummary`, `getEmailTextSummary`.
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
- **Scale crosshair** — plus icon at scale point A/B.
- **Set Scale first toasts** — for Quick Line / Polyline / Measure when no scale.
- **Choose Line Type modal** — tabs Choose | Create | Quick; search; `L` opens
  modal, `Shift+L` opens Quick tab.
- **Counter modal** — tabs Choose Counter / Create Counter; 9-color palette (no
  white); selected icon outlined.
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

- **Show Report** — `#showReportDropdown` (this canvas / all canvases on page / all
  plan pages current canvas / all pages and canvases); opens report in a new tab
  via `printReport(mode)`; hidden when no counts/lines.
- **Export PDFs** — `#specificPagesModal`: marker/line size sliders (25-150%),
  Include takeoff report / Bundle highlights / Bundle notes toggles, per-page
  marked/unmarked/exclude thumbnails, bulk actions; `downloadSpecificPages()`.
- **Copy to PipeTooling** — `#forPipeToolingDropdown` (drop-up): This Canvas Only /
  All Visible Canvases / All Canvases; tab-delimited via `getPipeToolingSummary`.
- **Copy Summary (Email/Text)** — `#copySummaryTextDropdown`, same canvas options,
  via `getEmailTextSummary`.
- **Show Highlights / Show Notes** — open summaries in a new tab; toggles in the
  Export PDFs modal bundle them into the PDF.
- **Download current page** — `#downloadCurrentPageBtn` (yellow printer): direct
  download for single page+canvas, otherwise a mode dropdown (this canvas / all
  canvases on page / all pages current canvas / all pages and canvases);
  `downloadCurrentPageAsPdf(mode)`.
- **Download PDF** — Project Settings downloads the project PDF as-is; Prepare PDF
  modal "Download Trimmed PDF" downloads kept pages.
- **Export / Import Canvas** — JSON canvas export/import (Advanced + header export
  dropdown + sidebar); export gated by `projectHasAnyCanvasMarkup()`.
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

### Canvas layers

- **Multiple canvases per page** — each `page.canvases[]` is an overlay layer;
  active layer per page in `state.activeCanvasIdByPage`; pills + layers dropdown;
  Up/Down arrows switch layers; viewers can browse layers locally (no dirty).

### Editing aids

- **Undo/Redo** — last 5 moves in memory; `undoStack`/`redoStack`; Ctrl+Z /
  Ctrl+Shift+Z; cleared on load/switch/viewer.
- **Middle mouse pan** — hold middle button to pan regardless of tool.
- **Canvas context menu** — `#contextMenu` on right-click / long-press;
  `handleContextMenu` -> `hitTest` -> `state.ctxTarget`; `#ctxTargetNameRow` shows
  the counter/line-type name below Delete; not available in view mode.
- **Hotkeys** — M/S/C/L/J/P/D/H/X/N/R; Shift+C / Shift+L open Quick tabs; arrows:
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
  create/list/copy/access-log/revoke; `?t=TOKEN`; `get-view-project` Edge Function;
  email domain gate; `initViewOnlyMode`.
- **Artboard** — User Settings save/load counters, line types, and modifiers to the
  user profile (`user_airboard`).
- **Admin** — Add/Manage/All Users, Manage Projects (delete + force turn-in), User
  Activity (Events + Summary, Chicago time), Global force reload
  (`admin_trigger_global_reload`, `system_settings`).
- **Dev auth bypass** — `?devAuth=1` (localhost) or "Sign in as test user";
  requires `DEV_AUTH_EMAIL` / `DEV_AUTH_PASSWORD` in `config.js`.

## Migrations naming

`supabase/migrations/` contains two naming schemes: legacy numbered
`NNN_name.sql` (001-041) and Supabase-CLI timestamped `YYYYMMDDHHMMSS_name.sql`.
Apply in version order (numbered first, then timestamped); see
[SUPABASE_SETUP.md](SUPABASE_SETUP.md) for per-migration notes. New migrations
should be applied via the Supabase MCP `apply_migration` tool.

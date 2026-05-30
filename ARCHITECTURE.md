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
| [app.js](app.js) | The entire app logic — the former inline `index.html` IIFE, extracted verbatim into a classic `<script src>` (`(function() { … })();`, ~16.2k lines). Resolves the sibling modules' values by bare name; exposes its own helpers to `report.js` via `window.*` at the IIFE tail. Linted (`no-undef` as error, the rest of the recommended set as warnings) |
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
| [scripts/build-toc.js](scripts/build-toc.js) | Node script (no deps) that regenerates the line-numbered section index in this file from the `// SECTION:` markers in [app.js](app.js), writing between the BEGIN/END SECTION TOC markers; `npm run build:toc` rewrites in place, `node scripts/build-toc.js --check` exits non-zero when stale |
| [eslint.config.js](eslint.config.js) | ESLint v9 flat config for all `.js` (browser modules + Node tooling + `app.js`); `npm run lint`. Enumerates report.js's cross-file project globals as `readonly` so `no-undef`/`no-redeclare` stay on. The `app.js` group auto-derives the sibling modules' exports as `readonly` globals (via `require()`) and runs the recommended set as warnings with `no-undef` re-raised to error. Now that the JS lives in `app.js` (not an inline `<script>`), the whole app is linted |

High level: the `<head>` of [index.html](index.html) loads `config.js`, the CDN
libs (pdf.js, pdf-lib, html2canvas, jsPDF, supabase-js), `styles.css`,
`icons.js`, `geometry.js`, `constants.js`, and `save-utils.js`. The body holds
the app shell + every modal, then loads `app.js` (the single JS IIFE — the whole
app logic) followed by `report.js`. The CSS, icon data, pure geometry/parse
primitives, pure constant literals, pure save/sync helpers, and finally the main
IIFE itself were lifted out of `index.html` into `styles.css` / `icons.js` /
`geometry.js` / `constants.js` / `save-utils.js` / `app.js` (no build step —
plain `<link>` / `<script src>`). `app.js` resolves the module values by bare
name (shared global lexical scope); `report.js` resolves `app.js`'s output via
`window.*`.

## Section index (grep `// SECTION:`)

The JS in [app.js](app.js) is organized with `// SECTION:` comment markers. The
live list with current `app.js` line numbers is generated by `npm run build:toc`
(run it after adding or moving a `// SECTION:` marker;
`node scripts/build-toc.js --check` fails if stale):

<!-- BEGIN SECTION TOC (generated by scripts/build-toc.js - do not edit by hand) -->

- L2 - Constants
- L53 - Icon data (icon *_PATH consts, VB_384_512_PATHS, CUSTOM_ICONS) lives in icons.js,
- L151 - ICONS array lives in icons.js (see icon-data note above).
- L352 - State
- L580 - Sync recovery & client recycle
- L927 - Global force reload
- L1058 - Save Status log & envelope
- L1143 - Dirty tracking & local session reset
- L1358 - Checkout probe, hashing & PDF cache
- L1836 - Math & Format Helpers
- L2576 - Save Status modal
- L2643 - Coordinate Helpers
- L2655 - PDF Rendering
- L3827 - UI Render Functions
- L5917 - Modals & Handlers
- L6068 - Prepare PDF modal
- L6689 - Scale modal
- L6903 - Counter modal
- L7344 - Quick Plumbing / Quick Count modals
- L7787 - Quick Line modal
- L7971 - Groups
- L8066 - Multiply Zone settings
- L8525 - Zoom modal
- L8681 - Canvas layers
- L8886 - Export PDFs modal
- L9262 - Copy summaries (PipeTooling / Email)
- L9395 - PDF bundling (report / notes / highlights)
- L9787 - Download current page
- L10031 - Note modal
- L10206 - User activity time formatting
- L10433 - User Activity modal (admin)
- L10501 - User Settings & Manage Users
- L10664 - Canvas Repair
- L10735 - Manage Icons modal
- L10873 - Manage Projects modal
  - L11033 - Project Settings checkout & Save Status bell
  - L11222 - Checkout expired recovery
  - L11476 - Turn In
  - L11978 - Share project & view links
  - L12197 - Cloud project hydrate / copy / fork
  - L12384 - Load Project modal
- L13820 - Canvas Event Handlers
- L14108 - Event Binding
- L14861 - Manual save to cloud
- L15310 - Auto-save
- L15607 - Local backup (IndexedDB takeoff state)
- L15822 - Checkout keep-alive
- L15875 - View-only mode
- L16028 - Init / boot

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
  - Quick Line modal — `populateQuickLineModal`, line modifiers
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

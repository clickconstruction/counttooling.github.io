# ClickCount — Agent Instructions

## Doc map

- [RECONSTITUTE.md](RECONSTITUTE.md) — base spec: core data model, coordinate
  contract, invariants. Read this first to understand what the app *is*.
- [ARCHITECTURE.md](ARCHITECTURE.md) — code map (how to navigate `app.js` +
  `index.html`) and the full feature catalog ("Features Beyond Spec").
- [CHANGELOG.md](CHANGELOG.md) — implementation history (the sync-hardening PRs and
  other detail). Consult when you need the "why" behind the save/sync machinery.
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) — cloud setup, migrations, Edge Functions.
- [CUSTOM_ICONS.md](CUSTOM_ICONS.md) — bundled vs user-uploaded icons.

## Tech constraints

- Vanilla HTML, CSS, JavaScript. No build step; static deployment.
- Static assets, no bundler: the app is split across a few files loaded via
  `<link>` / `<script src>` and sharing state through `window` globals and the
  shared global lexical scope — [index.html](index.html) (HTML shell + modals,
  ~2.1k lines; no inline JS logic — the body loads `app.js`, then the feature-file
  splits (`features/canvas-repair.js`, `features/note.js`, `features/zoom.js`,
  `features/manage-icons.js`, `features/multiply-zone-settings.js`,
  `features/export-pdfs.js`, `features/legend-settings.js`,
  `features/page-settings.js`, `features/counter-settings.js`,
  `features/line-type-settings.js`, `features/choose-create-line-type.js`,
  `features/scale.js`, `features/groups.js`, `features/grid.js`,
  `features/quick-line.js`, `features/counter.js`, `features/save-status.js`,
  `features/manage-projects.js`, `features/user-admin.js`,
  `features/load-project.js`, `features/prepare-pdf.js`,
  `features/quick-modals.js`, `features/pdf-bundle.js`), then
  `report.js`),
  [app.js](app.js) (the bulk of the app logic — the former inline `index.html`
  IIFE, extracted into a classic `<script src>` and since slimmed from ~16.2k to
  ~12.2k lines as the pure modules + the `window.App` feature-file splits were
  pulled out; resolves the
  sibling modules' values by bare name and exposes its own helpers to `report.js`
  via `window.*` at the IIFE tail; linted with `no-undef` as error, the rest of
  the recommended set as warnings), [styles.css](styles.css) (all CSS),
  [icons.js](icons.js) (bundled icon data: `*_PATH` consts, `VB_384_512_PATHS`,
  `FA_PATHS`, `RING_PATH`, `CUSTOM_ICONS`, `ICONS`; classic script loaded before
  app.js; guarded CommonJS export footer so `eslint.config.js` can derive the
  app.js lint globals),
  [geometry.js](geometry.js) (pure math/geometry/parse primitives: `ptDist`,
  `polylineDistance`, `polygonArea`, `distToSegment`, bezier helpers,
  `rotatePoint90CW`, `pointInRect`, `rectsOverlap`, zone locators,
  `formatLineLengthRealSum`, `parseRealWorldLength`, `parseFraction`, `formatAgo`,
  `formatFeetInchesFromVal`; classic script loaded before app.js; no `state`
  dependency; ends with a guarded CommonJS export footer that is inert in the
  browser so [geometry.test.js](geometry.test.js) can `require()` it in Node),
  [constants.js](constants.js) (pure module-level constant literals: `TOOL`,
  `SCALE_MODES`, `PLUMBING_DEFAULTS`, `LINE_DEFAULTS`, `COLORS`, `SCALE_PRESETS`,
  the autosave/checkout timing & threshold block, IndexedDB store names + caps,
  Save Status log windows, checkout messages, keys/URLs/TZ; classic script loaded
  before app.js; no `state`/`window`/icon dependency -- env reads (`SUPABASE_*`,
  `BACKUP_PDF_TO_INDEXEDDB`, `IS_DEV_HOST`), icon-derived consts, and
  function-local consts stay in app.js; same guarded CommonJS footer so
  [constants.test.js](constants.test.js) can `require()` it in Node),
  [idb.js](idb.js) (IndexedDB storage layer extracted from app.js: one
  `openPdfCacheDb` (DB `clickcount-pdf-cache` v5, 8 stores) + the context-free
  accessors `viewCache*`, `pdfCache*`, `takeoffBackupDelete`,
  `readSaveLogsSnapshots` and the pure primitives `idbTakeoffBackupGetRaw`,
  `idbTakeoffBackupPut`, `idbPutSaveLogsSnapshot`, `idbCustomIconsGet/Put`;
  classic script loaded **after constants.js** (reads its store-name/cap globals
  by bare name) and **before app.js**; depends only on constants + `indexedDB` +
  args, no `state`/loggers -- the state/logging concerns stay in app.js as
  same-named thin wrappers `takeoffBackupGet`, `takeoffBackupPut`,
  `writeSaveLogsSnapshot`, `customIconsGetFromIndexedDB`/`customIconsPutToIndexedDB`;
  guarded CommonJS footer so [idb.test.js](idb.test.js) can `require()` it with
  `fake-indexeddb`),
  [format.js](format.js) (pure date/time/text formatters extracted from app.js:
  `formatLastSignIn`, `dateKeyInTimeZone`, `calendarDaysFromSignInToNowInZone`,
  `formatLastSignInUserActivity`, `formatUserActivityDateTime`,
  `filterUserActivityRows`, `renderUserActivityAllUsersTableHtml`; classic script
  loaded **after constants.js** (reads `USER_ACTIVITY_TZ` by bare name) and
  **before app.js**; no `state`/DOM dependency -- the DOM-coupled User Activity
  modal code `applyUserActivityFilter`/`populateUserActivityUserSelect` stays in
  app.js; guarded CommonJS footer so [format.test.js](format.test.js) can
  `require()` it),
  [icon-render.js](icon-render.js) (pure icon geometry / render-rule helpers
  extracted from app.js: the `CUSTOM_ICON_META` table + `iconMetaFromList`,
  `iconViewBoxFromList`, `iconRenderVbRule`, `iconRenderCenterRule`,
  `iconViewBoxStringRule`, `iconSvgHtml`; classic script loaded **after icons.js**
  (reads `CUSTOM_ICONS`/`VB_384_512_PATHS`/`FA_PATHS` by bare name; the top-level
  `CUSTOM_ICON_META` read is `typeof`-guarded so Node `require` stays load-safe)
  and **before app.js**; depends only on icons.js globals + args, no
  `state`/DOM/user-icon-cache -- the cache-coupled lookups `getCustomIconMeta`,
  `getCustomIconViewBox`, `iconRenderVb`, `iconRenderCenter`, `iconViewBoxString`,
  `renderIconHtml` stay in app.js as same-named thin wrappers that inject
  `getEffectiveCustomIcons()`; guarded CommonJS footer so
  [icon-render.test.js](icon-render.test.js) can `require()` it),
  [line-metrics.js](line-metrics.js) (pure line-length / scale math extracted from
  app.js: `lineSegmentLength`, `lineGeomPdfPts`, `lineLengthPdfPts`,
  `effectiveScaleForLine`, `lineRealWorldLength`, `lineLengthForTotals`,
  `scaleForLineType`; classic script loaded **after geometry.js** (reads
  `ptDist`/`polylineDistance`/the bezier helpers/`getScaleZoneForLine`/
  `getMultiplyZoneForLine` by bare name) and **before app.js**; depends only on
  geometry.js globals + args, no `state` -- the per-page scale, the line's
  resolved line-type, and the pages array are injected by app.js's same-named thin
  wrappers `quickLineLength`/`getLineLengthPdfPts`/`getEffectiveScaleForLine`/
  `getLineRealWorldLength`/`getLineLengthForTotals`/`pickScaleForLineType` (which
  resolve those from `state` and keep their `window.*` exports for report.js); the
  module function names are deliberately distinct from the wrappers so the
  app.js-derived globals don't trip `no-redeclare`; guarded CommonJS footer so
  [line-metrics.test.js](line-metrics.test.js) can `require()` it after
  `Object.assign(globalThis, require('./geometry.js'))`),
  [save-utils.js](save-utils.js) (pure save/sync helpers: `isTransientSaveError`,
  `getProjectCounts`, `serializeSaveError` (the deduped error serializer that
  replaced app.js's near-identical `serializeSaveErrorForEvent` +
  `saveDebugSerializeError`), `formatSaveStatusErrDetail`, `backoffDelayMs`,
  `computeClockOffsetMs`, `percentile`; classic script loaded before app.js;
  app.js keeps the state-coupled callers (`updateServerClockFromRpc`, the auto-save
  backoff line, `recordAutosaveLatency`) that delegate to these; guarded CommonJS
  footer so [save-utils.test.js](save-utils.test.js) can `require()` it),
  [features/canvas-repair.js](features/canvas-repair.js) (the first feature-file
  split of the app.js IIFE via the `window.App` registry — the Canvas Repair
  modal; its own IIFE loaded **after app.js**, reads shared state/helpers from
  `window.App` at call time and registers `App.openCanvasRepairModal`/
  `App.applyCanvasRepair` back onto it; see "`window.App` registry" below),
  [features/note.js](features/note.js) (the second registry split — the Note
  add/edit modal; registers `App.openNoteModal` and binds the modal's Cancel/Done
  at load), [features/zoom.js](features/zoom.js) (the third registry split — the
  Zoom Settings modal; registers `App.showZoomModal`; `getMaxZoom`/
  `getWheelZoomSpeed` stay in app.js and are published-only),
  [features/manage-icons.js](features/manage-icons.js) (the fourth registry split
  and first multi-region move — the Manage Icons modal; registers
  `App.openManageIconsModal` and binds the modal's Close/Cancel/Save at load;
  `getOrderedIcons`/`iconVbFor`/`getUserCustomIcons`/`saveUserCustomIcons`/
  `showToast` stay in app.js and are published-only),
  [features/multiply-zone-settings.js](features/multiply-zone-settings.js) (the
  fifth registry split and first needing no new published deps — the Multiply
  Zone settings modal; registers `App.openMultiplyZoneSettingsModal` and binds
  the toggle/slider/Close at load; the Multiply Zone apply flow stays in app.js),
  [features/export-pdfs.js](features/export-pdfs.js) (the sixth registry split and
  largest single move — the Export PDFs modal's `specificPages*` cluster;
  registers `App.openSpecificPagesModal` and binds the `#specificPages*`
  buttons/scroll/nav at load; an interleaved move — the shared
  `sanitizeForFilename`/`downloadPdfBuffer`/`downloadProjectPdf` helpers + the
  PipeTooling toggle stay in app.js; 9 publish-only deps read via `App.*`),
  [features/legend-settings.js](features/legend-settings.js) (the seventh
  registry split and second zero-new-dep move — the Summary Legend settings
  modal's opener + close + 8 live appearance handlers; registers
  `App.openLegendSettingsModal` and binds the `#summarySectionTitle` opener at
  load; reuses `state`/`showModal`/`hideModal`/`renderPdf`; the `#summaryCollapseIcon`
  toggle, `drawLegend`, the legend overlay toggles, and `legendSettings`
  save/load all stay in app.js),
  [features/page-settings.js](features/page-settings.js) (the eighth registry
  split — the Page settings modal's opener + truncate/hide-unmarked toggles +
  close; registers `App.openPageSettingsModal` and binds the `#pagesSectionTitle`
  opener at load; one new publish-only dep `renderPagesList`, reuses
  `state`/`showModal`/`hideModal`/`updateUI`; the `#pagesCollapseIcon` toggle and
  the Escape-key close branch stay in app.js),
  [features/counter-settings.js](features/counter-settings.js) (the tenth registry
  split and first two-region consolidation — the Counter settings modal's
  opener + value handlers + close + reorder, merged from the grab-bag and the
  separate `// SECTION: Counter settings handlers` block; registers
  `App.openCounterSettingsModal` and binds the `#countersSectionTitle` opener at
  load; two new publish-only deps `renderAnnotations`/`renderCountersList`, reuses
  `state`/`showModal`/`hideModal`/`updateUI`/`showToast`; the `#countersCollapseIcon`
  toggle, the sidebar inline `#counterShowOnlyOnPageInlineBtn`, `#sidebarReorderFinish`,
  and the Escape branch stay in app.js; removing the emptied marker drops the
  section-count to 49),
  [features/line-type-settings.js](features/line-type-settings.js) (the eleventh
  registry split and final settings-modal unit — the Line Type settings modal's
  opener + value handlers + close + reorder + drop-icon grid; registers
  `App.openLineTypeSettingsModal` and binds the `#lineTypesSectionTitle` opener at
  load; two new publish-only deps `renderLineTypesList`/`DROP_ICON_STYLES`, reuses
  `renderAnnotations`/`state`/`showModal`/`hideModal`/`updateUI`/`showToast`; the
  header snap button, sidebar inline buttons, `#sidebarReorderFinish`, the J-hotkey,
  and the Escape branch stay in app.js; renamed the now-stale section marker to
  `// SECTION: Choose/Create Line Type, line color & sidebar handlers`),
  [features/choose-create-line-type.js](features/choose-create-line-type.js) (the
  twelfth registry split and first to share *constants* via the registry — the
  Choose/Create Line Type modal (`#chooseLineTypeModal`): `showLineTypeTab` +
  `populateChooseLineTypeList` + `showChooseLineTypeModal`; registers
  `App.showChooseLineTypeModal`/`App.showLineTypeTab` and binds the `.line-type-tab`
  clicks + `#lineTypeModalSearchInput` + `#chooseLineTypeCancel`/`#createLineTypeCancel`
  + `#createLineTypeCreate` at load; two new publish-only deps `TOOL`/`COLORS`
  (it also consumes `App.populateQuickLineModal`, which now comes from
  `features/quick-line.js` — pilot #16 — not app.js), reuses
  `state`/`uid`/`pushUndoSnapshot`/`markProjectDirty`/
  `showModal`/`hideModal`/`updateUI`; the line color modal
  (`showLineColorModal`/`applyLineColor` + `#lineColorCancel`/`#lineColorCustom`)
  stays in app.js; the three call sites (`#quickLine.onclick`, `#plumLineBtn.onclick`
  — now in quick-line.js, the
  Shift+L hotkey) reach it via `App.*`; renamed the section marker to
  `// SECTION: Line color & sidebar handlers`),
  [features/scale.js](features/scale.js) (the thirteenth registry split and first
  to route geometry.js globals + `SCALE_*` constants through the registry — the
  Scale modal (`#scaleModal`): `updateScalePlaceholder` + `openScaleModal` +
  `resetScaleModalZoneMode` + `applyScaleObjectToZoneOrPage` + `showScaleTab`;
  registers `App.openScaleModal`/`App.resetScaleModalZoneMode` and binds the
  `#setScale`/`#setScaleSidebar` openers + the `#scaleModalTabs`/`#scaleUnit`/
  `#scaleSelectOnPdf`/`#scalePresetsCancel`/`#scaleCustomApply`/`#scaleCancel`/
  `#scaleSet` handlers (which had been down in the Counter-modal region) at load;
  six new publish-only deps `SCALE_MODES`/`SCALE_PRESETS`/`ptDist`/`parseFraction`/
  `parseRealWorldLength`/`getActiveAnnotations`, reuses
  `state`/`showModal`/`hideModal`/`updateUI`/`renderPdf`/`pushUndoSnapshot`/
  `markProjectDirty`/`uid`/`ensureActiveCanvas`/`showToast`/`TOOL`; the modal
  doubles as the scale-zone create/edit dialog (`scaleModalApplyTarget === 'zone'`),
  so `applyScaleObjectToZoneOrPage` moves with it while the four `openScaleModal`
  callers (canvas two-point finish + scale-zone context-menu Edit) and the
  Escape-key `resetScaleModalZoneMode` branch keep their zone-entry state/DOM setup
  inline in app.js and reach the modal via `App.*`; the toolbar tool buttons that
  shared the old grab-bag stay in app.js under the renamed section marker
  `// SECTION: Toolbar tool buttons`),
  [features/groups.js](features/groups.js) (the fourteenth registry split and first
  two-modal move — the group create/edit modal (`#groupModal`) and the
  assign-item-to-group modal (`#groupAssignModal`): `openGroupModal` +
  `refreshGroupAssignButtons` + `openGroupAssignModal`, the three group-modal state
  flags `pendingGroupEdit`/`pendingGroupAssignTarget`/`openedGroupModalFromAssign`
  (private `let`s in the IIFE), and the `#addGroup` opener + `#groupModal*` /
  `#groupAssign*` handlers; registers `App.openGroupModal`/`App.openGroupAssignModal`/
  `App.onGroupModalHidden`. One new publish-only dep `App.deleteGroup` (the heavier
  group-deletion mutation stays in app.js); reuses
  `state`/`COLORS`/`uid`/`pushUndoSnapshot`/`markProjectDirty`/`updateUI`/`renderPdf`/
  `showModal`/`hideModal`. **First core-function -> feature callback**: the
  `hideModal('groupModal')` reset hook in app.js now calls
  `App.onGroupModalHidden()` instead of mutating the now-private
  `openedGroupModalFromAssign` flag directly. The `#showGroupColors` sidebar toggle
  stays in app.js; the two external callers (the groups-list Edit button in the
  render code and the canvas right-click "Assign to Group") reach the modals via
  `App.*`; the emptied `// SECTION: Groups` marker was removed, dropping the
  section count to 48),
  [features/grid.js](features/grid.js) (the fifteenth registry split — the Grid
  Settings modal (`#gridSettingsModal`) + the grid-overlay toggle, carved out of
  the `// SECTION: Counter modal` grab-bag: `toggleGridOverlay` + the
  `gridBtn`/`gridBtnSidebar` bindings + the `#gridSettings*`/`#gridSetOriginOnPage`/
  `#gridClearOrigin`/spacing-preset/line-style handlers; registers
  `App.toggleGridOverlay` (only for the spec/symmetry — nothing in app.js calls it,
  the Grid buttons are bound inside the feature). Two new publish-only deps
  `App.getPageScale`/`App.showSetScaleFirstToast`; reuses
  `state`/`markProjectDirty`/`renderPdf`/`updateUI`/`showModal`/`hideModal`/
  `showToast`/`parseRealWorldLength`. The `drawGrid` renderer, the snap-to-grid
  branch, the render-code grid-button active/disabled toggling, and
  `resetGridOrigin` (used by the prepare-PDF / page-setup flows, not the modal) all
  stay in app.js. The "set origin on page" handoff goes through the shared
  `state.gridOriginPickMode` flag — the feature sets it true and the app.js canvas
  handler reads it, writes the origin, flips it false, and reopens the modal — so
  **no registry callback is needed** (unlike the Groups
  `openedGroupModalFromAssign` case), because the flag lives on `state`, not a
  closure `let`. No marker change (the grab-bag keeps the counter modal + sidebar
  buttons + legend + `resetGridOrigin`), so the count stays 48),
  [features/quick-line.js](features/quick-line.js) (the sixteenth registry split —
  the Quick Line modal (the "quick" tab body of `#chooseLineTypeModal`):
  `populateQuickLineModal` + `updateQuickLineNamePreview` + `removeLineModifier` +
  the `#plumLineBtn` opener and the `#quickLine*` handlers. **Takes over publishing
  `App.populateQuickLineModal`** — that publish moved here from app.js, and
  `features/choose-create-line-type.js` keeps consuming it via `App.*` at call time
  (load order between the two feature files does not matter). Two new publish-only
  deps `App.getLineModifiers`/`App.saveLineModifiers` (the line-modifier
  persistence stays in app.js); reuses
  `state`/`COLORS`/`uid`/`pushUndoSnapshot`/`markProjectDirty`/`showModal`/
  `hideModal`/`updateUI`/`showLineColorModal`/`showLineTypeTab`. The separate
  "Add Line Type" modal (`#addLineType`/`#lineTypeModal`) stays in app.js; renamed
  the now-stale `// SECTION: Quick Line modal` marker to
  `// SECTION: Add Line Type modal` (rename, not removal, count stays 48)),
  [features/counter.js](features/counter.js) (the seventeenth registry split — the
  Counter modal (`#counterModal`) choose/create-counter picker, an **interleaved**
  extraction from the Counter-modal grab-bag: `showCounterTab` +
  `showCounterIconTab` + `populateCounterChooseList`, the choose-tab handlers
  (`#counterBtn`/`.counter-tab`/`#counterModalSearchInput`/`#counterChooseCancel`)
  and the create-tab handlers (`#addCounter`/`.counter-icon-tab`/`#counterIconSearch`/
  `#counterCancel`/`#counterCreate`); registers `App.showCounterTab`. Bidirectional
  quickcount coupling (same shape as Quick Line): it consumes
  `App.populateCounterQuickCountPanel` (the quickcount tab body stays in app.js's
  Quick Count section) and the Quick Count code + Shift+C hotkey reach the tab via
  `App.showCounterTab('quickcount')`. Three new publish-only deps `App.getIconName`/
  `App.getEffectiveCustomIcons`/`App.populateCounterQuickCountPanel`; reuses
  `state`/`COLORS`/`TOOL`/`uid`/`pushUndoSnapshot`/`markProjectDirty`/`showModal`/
  `hideModal`/`updateUI`/`getOrderedIcons`/`iconVbFor`. The interleaved neighbors
  (`#doneEditing`, the sidebar tool buttons, `toggleLegendOverlay` + legend
  buttons, the `iconVbFor` global helper) stay in app.js; the many
  `#counterBtn.click()` DOM triggers keep working since the handler moves with the
  element; renamed the `// SECTION: Counter modal` marker to
  `// SECTION: Tool sidebar buttons & legend overlay` (rename, count stays 48)),
  [features/save-status.js](features/save-status.js) (the eighteenth registry split
  and first save/sync-domain UI split — the on-demand Save Status modal
  (`#saveStatusModal`): `renderSaveStatusModalContent` + `openSaveStatusModal` +
  the render helpers `escSaveStatusHtml`/`applySaveStatusSummaryBlock` + the bell
  open buttons and `#saveStatusModalClose`/`#saveStatusModalDone`/
  `#saveStatusVerboseToggle`/`#saveStatusExportBtn`/`#saveStatusCopyBtn` handlers,
  with the modal's `saveStatusModalTickTimer` now a private `let`; registers
  `App.openSaveStatusModal` + `App.renderSaveStatusModalContent`. The **hot-path
  bell** `updateSaveStatusIndicator` (called from 25+ sites incl. updateUI) and the
  whole save engine stay in app.js. Seven new publish-only deps
  (`getCloudSaveSummary`, `pruneSaveStatusLog`, `getSaveStatusLogWindowMs`,
  `isSaveDebugEnabled`, `setSaveDebugEnabled`, `buildSaveLogsEnvelopeWithSnapshots`,
  `pushSaveEvent`) plus **two getter accessors** `App.getSaveStatusLog()` and
  `App.isCheckoutExpiredAttention()` — used instead of value publishes because the
  underlying app.js vars (`saveStatusLog`, reset to `[]`; `checkoutExpiredNeedsAttention`,
  many   engine writers) are reassigned and a captured reference would go stale (the
  getter-accessor pattern to reuse for the eventual SaveManager extraction);
  reuses `showModal`/`hideModal`/`showToast`. The `#syncPausedBannerRetry` handler
  stays in app.js. Removed the emptied `// SECTION: Save Status modal` marker,
  dropping the section count to 47),
  [features/manage-projects.js](features/manage-projects.js) (the nineteenth
  registry split — the admin Manage Projects modal (`#manageProjectsModal`):
  `openManageProjectsModal` (lists projects via the `list_projects_for_admin` RPC)
  + the internal `forceCheckInProjectFromManage` (`force_check_in_project` RPC) +
  `deleteProject` (`admin-delete-project` Edge Function) + the
  `#manageProjectsModalClose` handler; registers `App.openManageProjectsModal`.
  Cloud-coupled: it reaches the Supabase client via **`App.getSupabase()`** (the
  second getter-accessor — `supabase` is reassigned by the client-recycle
  `recreateSupabaseClient`, so a value publish would go stale). Five other new
  publish-only deps — the env constants `SUPABASE_URL`/`SUPABASE_ANON_KEY` and the
  engine helpers `updateServerClockFromRpc`/`clearCheckoutExpiredAttention`/
  `resetAutoRecheckoutCounter` (the last published as a deferred wrapper since it
  is a sloppy-mode hoisted block declaration); reuses
  `state`/`showModal`/`hideModal`/`showToast`. The `#settingsManageProjects` opener
  and the Escape-key close branch stay in app.js (the opener reaches it via
  `App.openManageProjectsModal`); the auth/settings entry-button block that shared
  the old grab-bag stays under the renamed marker
  `// SECTION: Auth & settings entry buttons` (rename, count stays 47)),
  [features/user-admin.js](features/user-admin.js) (the twentieth registry split —
  the admin user-management modals: `openManageUserModal` (the user list +
  delete + activity, via the `list_users_for_admin` RPC / `admin-list-users` Edge
  Function), `openAllUsersModal` (read-only list), `deleteUser`
  (`admin-delete-user`), plus the `#manageUsersBtn` create-user opener +
  `#adminCreateForm` (`admin-create-user`) and the
  `#adminPanelClose`/`#manageUserModalClose`/`#allUsersModalClose`/
  `manageUserModalAllActivityBtn` handlers; registers `App.openManageUserModal` +
  `App.openAllUsersModal`. Three new publish-only deps — `App.formatLastSignIn`
  (a format.js global, lint-invisible to the features group), `App.USER_ACTIVITY_ICON_SVG`,
  and `App.openUserActivityModal` (the User Activity modal **stays** in app.js;
  the moved lists + the all-activity button reach it via `App.*`); reuses the
  already-published `state`/`showModal`/`hideModal`/`SUPABASE_URL`/`SUPABASE_ANON_KEY`.
  **My Settings** (`openMySettings`, which owns the airboard cloud-sync) stays in
  app.js under the renamed marker `// SECTION: My Settings modal`; its
  `#mySettingsManageUser`/`#mySettingsAllUsers` openers reach the feature via
  `App.*`, and `#mySettingsManageUsers` opens the create-user panel via a DOM
  `#manageUsersBtn` click. The moved handlers were interleaved with the User
  Activity + Canvas Repair handlers (which stay) in the Event Binding region — no
  marker change there (count stays 47)),
  [features/load-project.js](features/load-project.js) (the twenty-first registry
  split and the **most dependency-heavy** so far — the cloud Load Project modal
  `openLoadProjectModal` (~585 lines: the project browser list, ownership/role
  filters, per-row access panels + invite, copy/download/delete row actions, and
  the project-load action). Registers `App.openLoadProjectModal`; the
  save-before-load gate `openLoadProjectModalOrPromptSave` + the `#loadProject*`
  bindings + Escape branch stay in app.js and call `App.openLoadProjectModal()`.
  Because the project-load action is fused with the boot/engine path, the feature
  reaches ~20 publish-only deps via `App.*` and re-reads `App.getSupabase()` in
  the outer fn + each nested async helper (the client can be recycled). New
  publish-only deps: `updateSaveStatusIndicator`, `canUseDevAuth`,
  `deleteProjectAsOwner`, `openCopyProjectModalOrPromptSave`,
  `hydrateProjectFromCloudRow`, `clearUndoStacks`,
  `subscribeToProjectCheckoutChanges`, `checkInCurrentProjectIfHeld`,
  `takeoffBackupGet`, `resolvePdfBufferForCloudProject`, `ensureGroupColors`,
  `openCanvasOnlyNeedsPdfModal`, `buildPagesFromPdfArrayBufferAndProjectData`,
  `backupDataToProjFormat`, `fitZoom`, `SUPABASE_URL`, plus four **setters**
  (`setAutoSaveDirty`/`setLastModifiedAt`/`setLastLocalBackupAt`/`setLastSaveIncludedPdf`)
  for engine `let`-state the load action resets (it cannot assign through the
  registry otherwise). The leftover grab-bag under the old `// SECTION: Load
  Project modal` marker was re-sectioned into 8 honest markers — Settings menu
  actions & Airboard sync, My Settings password & Auth sign-in, Save Project
  modal, Copy project modal, Checkout expired recovery modal wiring,
  Save-before-load modal, Last-session restore prompt, User Activity filters &
  view toggle — and the `Canvas Event Handlers` marker moved up to absorb the
  stray `showContextMenu`. The modal header also has an admin-only **Advanced**
  toggle (`#loadProjectAdvancedToggle`, persisted via `loadProjectAdvanced`) that
  shows/hides every row's "Who has access" block (`.load-project-admin-access`)
  by toggling a `hide-access` class on `#loadProjectList`; default OFF =
  hidden),
  [features/prepare-pdf.js](features/prepare-pdf.js) (the twenty-second registry
  split — the Prepare PDF modal `openPreparePdfModal` + its preview/nav/render
  helpers (`renderPreparePdfPreview`, `saveCurrentPageName`,
  `updatePreparePdfControls`), `preparePdfRotatePage90`, `commitPreparePdfToState`,
  `closePreparePdfModal`, and the `#preparePdf*` bindings. The ~9 private
  `preparePdf*` state lets move **with** the feature as module-locals (no
  setters). Registers `App.openPreparePdfModal` and re-assigns
  `window.closePreparePdfModal` (inline-HTML/Escape use it). The PDF intake
  pipeline (file upload, `loadTestPdf`, hashing) **stays** in app.js under the
  renamed `// SECTION: PDF intake (upload, test PDF, hashing)` marker and opens
  the modal via `App.openPreparePdfModal()`. Eight publish-only deps — the PDF
  helpers `assertPdfWithinLimit`/`mergePdfBuffers`/`buildTrimmedPdfBuffer`/
  `resetGridOrigin`, plus the Save-and-open flow's
  `writeTakeoffStateBackup`/`downloadPdfBuffer`/`performSaveProjectToCloud`/
  `isAuthError` (all outer-scope, no hoist trap); the `features/*.js` eslint group
  gained the CDN-lib globals (`pdfjsLib`/`PDFLib`/`jspdf`/`html2canvas`). The two
  interleaved sibling functions `openCanvasOnlyNeedsPdfModal` /
  `updateCanvasOnlyNeedsPdfBanner` stay in app.js (extracted around)),
  [features/quick-modals.js](features/quick-modals.js) (the twenty-third registry
  split and the cleanest since the early modals — the Quick Plumbing
  (`populatePlumModal` + icon-tab helpers + `removePlumbingModifier` + the
  `#plumBtn` opener) and Quick Count (`populateCounterQuickCountPanel` + parallel
  icon-tab helpers) clusters. No setters/flag-accessors, no private module state;
  two new publish-only deps `getPlumbingModifiers`/`savePlumbingModifiers`.
  Registers `App.populatePlumModal`, `App.populateCounterQuickCountPanel` (its
  registration **moved here from app.js** — `features/counter.js`'s
  `showCounterTab('quickcount')` calls it), and `App.updateCounterQuickCountNamePreview`
  (the shared custom-icon-upload handler in app.js refreshes the Quick Count grid
  via it); the modal calls back into `App.showCounterTab` — the bidirectional
  Quick-Count↔counter coupling is mediated entirely by the registry),
  [features/pdf-bundle.js](features/pdf-bundle.js) (the twenty-fourth registry
  split — the PDF-bundling helpers `addReportPagesToPdf`, `addNotesToPdf`,
  `addHighlightsToPdf`, `hasAnyHighlights`, `hasAnyNotes` (report/notes/highlights
  → jsPDF). Notably these were **already all on `App`** (publish-only for
  `features/export-pdfs.js`), so the split **re-homes** their registrations from
  app.js to the feature; `export-pdfs.js` keeps working via `App.*`. One new
  publish-only dep `wrapNoteText`; deps `renderAnnotationsToContext`/
  `getPageCanvases`/`getActiveAnnotations` already on `App`; `buildReportHtml`
  (report.js) + `html2canvas` (CDN) are runtime globals resolved at export time
  (added `buildReportHtml` to the `features/*.js` eslint globals). app.js's 6
  internal callers (updateUI bundle-button visibility + the Copy-summaries export
  path) convert to `App.*`; the interleaved `importCanvasAfterPdf`/`clearPage`
  modals stay), and
  [report.js](report.js).
- [report.js](report.js) loads after app.js and consumes these globals (keep
  them on `window`): `state`, `makeAnnotations`, `ptDist`, `polylineDistance`,
  `formatDist`, `renderIconHtml`, `quickLineLength`, `getLineLengthPdfPts`,
  `getLineLengthForTotals`, `getLineRealWorldLength`, `getMultiplyZoneForLine`,
  `getMultiplyZoneForPoint`, `getEffectiveScaleForLine`, `getMergedAnnotationsForPage`.
  It exposes `buildReportHtml`, `printReport`, `getPipeToolingSummary`,
  `getEmailTextSummary`; both summary functions accept optional
  `{ pageIndices, getAnnotations }`. The `window.*` attachment is wrapped in
  `if (typeof window !== 'undefined')` and there is a guarded CommonJS export
  footer (`module.exports = { escapeHtml, pickScaleForLineType }`) -- both inert
  in the browser -- so [report.test.js](report.test.js) can `require()` those
  pure helpers; keep both guards when editing the IIFE's tail.
- jsPDF for Export PDF; html2canvas for report-to-PDF.
- **Tests**: `npm test` runs the Playwright end-to-end specs; `npm run test:unit`
  runs the Node unit tests ([geometry.test.js](geometry.test.js),
  [constants.test.js](constants.test.js), [report.test.js](report.test.js),
  [save-utils.test.js](save-utils.test.js), [idb.test.js](idb.test.js),
  [format.test.js](format.test.js), [icon-render.test.js](icon-render.test.js),
  [line-metrics.test.js](line-metrics.test.js)) via
  `node --test`. All are dependency-free except [idb.test.js](idb.test.js),
  which uses the `fake-indexeddb` devDependency. [format.test.js](format.test.js)
  auto-skips its two en-CA-hyphen-dependent cases on a limited-ICU runtime and
  runs them on full-ICU (browser-equivalent / CI Node 20). Naming split (enforced by `testMatch` in
  [playwright.config.js](playwright.config.js)): `*.spec.js` = Playwright,
  `*.test.js` = Node unit tests.
- **Aggregate check**: `npm run check` runs lint + `test:unit` + `build:toc --check`
  (fast, no browser/cloud). [.github/workflows/ci.yml](.github/workflows/ci.yml)
  runs it on every push/PR (Node 20); Playwright is excluded from CI because it
  needs a server + Supabase/dev-auth secrets.
- **Linting**: `npm run lint` (ESLint v9 flat config, [eslint.config.js](eslint.config.js))
  covers all the `.js` — the browser modules (`geometry.js`, `constants.js`,
  `idb.js`, `format.js`, `icons.js`, `icon-render.js`, `line-metrics.js`,
  `save-utils.js`,
  `report.js`), the whole app (`app.js`), and the Node tooling (tests, specs +
  helpers, `scripts/`, configs).
  Now that the JS lives in `app.js` (not an inline `<script>`), the entire app is
  linted. The `app.js` group auto-derives the sibling modules' exports as
  `readonly` globals (via `require()`, including `idb.js`, `format.js`,
  `icon-render.js`, and `line-metrics.js`); the constants-only pure-module group
  (`idb.js` + `format.js`)
  gets a constants-only global set, `icon-render.js` gets its own icons-only
  group (`icons.js` globals), and `line-metrics.js` gets a geometry-only group
  (`geometry.js` globals) -- in all cases not their own exports, which would
  trip `no-redeclare`. A `features/*.js` group lints the registry feature files
  (browser globals + `module` readonly, `no-undef` error, `no-unused-vars` off).
  The `app.js` group
  runs the recommended set as **warnings** with `no-undef`
  re-raised to **error** — so `no-undef` must stay clean while the existing
  `no-unused-vars`/etc. warnings are a triage backlog (don't add new ones). A few
  IIFE-internal helpers unreachable to eslint-scope from every call site
  (`closePreparePdfModal` window-assigned; `hydrateProjectFromCloudRow` /
  `resetAutoRecheckoutCounter` sloppy-mode block declarations hoisted to the IIFE
  scope at runtime) are listed as `readonly` globals in the app.js group.
  report.js's cross-file project globals are enumerated as `readonly` so
  `no-undef` / `no-redeclare` stay on as errors -- if you add a new cross-file
  global consumed by report.js, add it to `projectGlobals` in the config. Pinned
  to eslint v9 because v10's formatter needs Node >= 20.12 (this repo runs Node
  20.0.0).
- **Section index**: `npm run build:toc` ([scripts/build-toc.js](scripts/build-toc.js))
  regenerates the line-numbered list between the BEGIN/END SECTION TOC markers in
  [ARCHITECTURE.md](ARCHITECTURE.md) from the `// SECTION:` markers in app.js;
  run it after adding/moving a marker (`--check` exits non-zero when stale).
- Supabase is **optional** (gated by `SUPABASE_ENABLED`). When enabled it provides
  Auth, the `projects` table (`pdf_path`, `pdf_hash`, `size_bytes`), the `pdfs`
  storage bucket, several RPCs, and Edge Functions (`admin-create-user`,
  `admin-delete-user`, `admin-delete-project`, `admin-list-users`,
  `invite-to-project`, `get-view-project`). Config via `config.js` (see
  [SUPABASE_SETUP.md](SUPABASE_SETUP.md)). PDF uploads capped at 50 MB.
- **Supabase migrations**: when creating or modifying files in
  `supabase/migrations/`, apply them via the Supabase MCP `apply_migration` tool
  (name = filename without `.sql`, query = file contents).

## Navigation

1. Read [RECONSTITUTE.md](RECONSTITUTE.md) for the core model, then
   [ARCHITECTURE.md](ARCHITECTURE.md) for the code map and feature catalog.
2. **Do not trust line numbers** — [app.js](app.js) is ~12.2k lines. Navigate
   by `// SECTION:` markers (`rg "^\s*// SECTION:" app.js`) and the grep-pattern
   table in ARCHITECTURE.md.
3. Prefer targeted reads (with offset/limit) over loading the whole file.

## Conventions

- Preserve existing patterns and structure.
- Coordinates: annotations are stored in PDF-space; convert with `canvasToPdf` /
  `toCanvas` (toCanvas includes devicePixelRatio). Never store canvas pixels.
- Scale is **per page**: `page.scale`; read via `getPageScale(pageIdx)`. There is no
  global `state.scale`.
- Do not remove or rename the `window.*` globals consumed by report.js.
- `makeAnnotations()` is the canonical annotation shape; new annotation kinds must
  be added there and to save/load + export/import.
- Keep the app functional with Supabase disabled.
- When adding a new persisted setting or per-project field, include it in
  export/import and save/load.

### `window.App` registry (splitting app.js)

`app.js` is one ~12.2k-line IIFE, so feature code that moves to a separate
`<script>` cannot see its closure-locals by bare name. The `window.App` registry
is the bridge for incremental splits (full contract + extraction recipe in
[ARCHITECTURE.md](ARCHITECTURE.md) "Feature files / `window.App` registry").
Rules to follow when adding/editing a feature file:

- `app.js` publishes the shared surface near its tail
  (`// SECTION: App feature registry`): `const App = (window.App = window.App || {});`
  then `App.state = state; App.renderPdf = renderPdf; …` (currently also `uid`,
  `makeAnnotations`, `applyRotationDeltaToAnnotations`,
  `reconcileOrphanedCountersAndLineTypes`, `pushUndoSnapshot`, `markProjectDirty`,
  `showModal`, `hideModal`, `updateUI`, `showLineColorModal`, `ensureActiveCanvas`,
  `getMaxZoom`, `getWheelZoomSpeed`, `getOrderedIcons`, `iconVbFor`,
  `getUserCustomIcons`, `saveUserCustomIcons`, `showToast`, `getPageCanvases`,
  `renderAnnotationsToContext`, `addReportPagesToPdf`, `addHighlightsToPdf`,
  `addNotesToPdf`, `hasAnyHighlights`, `hasAnyNotes`, `sanitizeForFilename`,
  `logUserEvent`, `renderPagesList`, `renderAnnotations`, `renderCountersList`,
  `renderLineTypesList`, `DROP_ICON_STYLES`, `TOOL`, `COLORS`,
  `SCALE_MODES`, `SCALE_PRESETS`, `ptDist`,
  `parseFraction`, `parseRealWorldLength`, `getActiveAnnotations`, `deleteGroup`,
  `getPageScale`, `showSetScaleFirstToast`, `getLineModifiers`,
  `saveLineModifiers`, `getIconName`, `getEffectiveCustomIcons`,
  `populateCounterQuickCountPanel`, `getCloudSaveSummary`, `pruneSaveStatusLog`,
  `getSaveStatusLogWindowMs`, `isSaveDebugEnabled`, `setSaveDebugEnabled`,
  `buildSaveLogsEnvelopeWithSnapshots`, `pushSaveEvent`, the getter accessors
  `getSaveStatusLog`/`isCheckoutExpiredAttention`, `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `updateServerClockFromRpc`, `clearCheckoutExpiredAttention`,
  `resetAutoRecheckoutCounter`, the `getSupabase` getter accessor,
  `formatLastSignIn`, `USER_ACTIVITY_ICON_SVG`, `openUserActivityModal`).
  (`populateQuickLineModal` is no
  longer published here — it moved to `features/quick-line.js`, which registers it.)
  Some are
  "publish-only" — the function stays defined in app.js (used widely there) and
  is just exposed on `App` (`ensureActiveCanvas`, `getMaxZoom`,
  `getWheelZoomSpeed`, `getOrderedIcons`, `iconVbFor`, `getUserCustomIcons`,
  `saveUserCustomIcons`, `showToast`, the 9 Export PDFs deps
  `getPageCanvases`/`renderAnnotationsToContext`/`addReportPagesToPdf`/
  `addHighlightsToPdf`/`addNotesToPdf`/`hasAnyHighlights`/`hasAnyNotes`/
  `sanitizeForFilename`/`logUserEvent`, Page settings's `renderPagesList`,
  Counter settings's `renderAnnotations`/`renderCountersList`, Line type
  settings's `renderLineTypesList`/`DROP_ICON_STYLES`, Choose/Create Line
  Type's two constants `TOOL`/`COLORS`, Quick Line's
  `getLineModifiers`/`saveLineModifiers`, Counter's
  `getIconName`/`getEffectiveCustomIcons`/`populateCounterQuickCountPanel`, and
  Scale's `getActiveAnnotations`, the geometry globals
  `ptDist`/`parseFraction`/`parseRealWorldLength`, plus the constants
  `SCALE_MODES`/`SCALE_PRESETS`, Groups' `deleteGroup`, and Grid's
  `getPageScale`/`showSetScaleFirstToast`);
  only the feature's own functions move out. Add any new dep a feature needs here. Leave the
  existing `window.*` report.js exports alone.
- `features/<name>.js` is its own IIFE that does
  `const App = (window.App = window.App || {});`, rewrites every bare app-dep to
  `App.*`, and registers its public entry points (`App.fn = fn;`).
- **Load order**: feature files load **after** `app.js` (before `report.js`).
  Read deps from `App.*` **inside** functions (at call time), never at module load.
- **Deferred bindings**: call sites in `app.js` must use `() => App.fn()`, never
  `App.fn` captured before the feature file registers it.
- **Core-function -> feature callbacks**: when a function that stays in `app.js`
  must mutate state that has moved into a feature file (e.g. a private flag), the
  feature registers a callback and the core function invokes it defensively:
  `App.onX && App.onX()`. Example: `hideModal('groupModal')` calls
  `App.onGroupModalHidden()` (features/groups.js) to reset the now-private
  `openedGroupModalFromAssign` flag.
- **Getter accessors for reassigned vars**: when a feature must *read* an app.js
  var that gets **reassigned** (so `App.x = x` would capture a stale reference),
  publish a getter instead: `App.getX = () => x;`. Example:
  `App.getSaveStatusLog = () => saveStatusLog;` and
  `App.isCheckoutExpiredAttention = () => checkoutExpiredNeedsAttention;`
  (features/save-status.js) — the log array is reset to `[]` and the flag has many
  engine writers. (A plain object/array that is only *mutated in place* can still
  be a direct value publish; the getter is only needed when the binding itself is
  reassigned.) Also `App.getSupabase = () => supabase;` (features/manage-projects.js)
  — the `supabase` client is reassigned by the client-recycle machinery. A related
  case: a function published before its declaration has executed (e.g. a
  sloppy-mode hoisted block declaration like `resetAutoRecheckoutCounter`) should
  be published as a deferred wrapper `App.fn = (...a) => fn(...a)` so the lookup
  happens at call time.

### Persisted settings (localStorage unless noted)

`counterSettings`, `lineTypeSettings` (includes `parallelEndsSize`,
`lengthLabelSize`, `snapToHorizontalVertical`, `showOnlyLinesOnCurrentPage`),
`legendSettings`, `multiplyZoneSettings`, `gridSettings`, `showGridOverlay`,
`exportSettings` (includes `bundleHighlightsToPdf`, `bundleNotesToPdf`),
`recentLineColors`, `iconNames`, `iconOrder`, `pageScales`, `zoomSettings`,
`groupColorDisplay`, `pagesTitlesTruncated`, `hideUnmarkedPagesFromSidebar`,
`counterSearch`, `lineTypeSearch`, `linesSearch`, `linesTypeExpanded`,
`loadProjectFiltersExpanded`, `loadProjectAdvanced` (admin-only; shows the Load
Project rows' "Who has access" block), `plumbingModifiers` (includes `iconByType`),
`lineModifiers`, `specificPagesIncludeReport`, `clickcount-last-project`,
`clickcount-last-global-reload`, `clickcount-debug-save` (Save Status Verbose
mode).

- `customIconPaths` lives in **IndexedDB** (in-memory cache, per-user key; one-time
  migration from localStorage / legacy key).
- Per-project, in save/load: `maxZoom`, `groups`, `activeCanvasIdByPage`.
- In-memory only (not persisted): `state.pdfBufferSize` (bytes; set whenever
  `state.pdfBuffer` is set, because pdf.js detaches the buffer making `byteLength`
  0), `state.userActivityAllRowsCache`, `state.userActivityViewMode`.
- `config.example.js` is the template; `config.js` is committed for production.

### Cloud state (when Supabase enabled)

`state.supabaseSession`, `state.isAdmin`, `state.currentProjectId`,
`state.currentProjectName`, `state.isViewer`, `state.canCheckOut`,
`state.checkedOutBy` / `checkedOutAt` / `checkedOutEmail`, `state.projectOwnerId`,
`state.loadedViaViewLink`. Cloud-only UI is hidden when `SUPABASE_ENABLED` is false.

### Save / sync (current behavior; history in CHANGELOG.md)

- Auto-save every 5s when dirty (Supabase signed-in -> cloud; unsigned ->
  localStorage); plus a 5s localStorage backup and an IndexedDB takeoff backup for
  recovery. Key symbols: `markProjectDirty`, `performAutoSave`,
  `performSaveProjectToCloud`, `autoSaveDirty`, `dirtyGeneration`.
- The save/sync layer is hardened against flaky networks, wedged `supabase-js`
  clients, clock skew, and multi-tab/multi-user leaks (abortable timeouts, capped
  backoff, recovery probe, client recycle, raw-fetch fallbacks, per-user data
  hygiene, dirty-generation correctness). Full detail: [CHANGELOG.md](CHANGELOG.md)
  "Sync hardening".
- Save Status: a header bell and an in-modal bell open `saveStatusModal` (gray
  normally; yellow on sync failure or checkout expiry; dim when offline). The modal
  shows a rolling activity log with Verbose mode, Copy logs, and Export logs
  (`buildSaveLogsEnvelope`, schema `clickcount-save-logs/v1`). The export envelope
  carries diagnostic context for user-reported save/sync errors: `tabSessionId`
  (per-tab id), `timing` (token expiry `sessionExpiresAt`/`secondsToExpiry`,
  degradation metrics `clientRecycles`/`autosaveLatencyP50`/`P95`/`degradedForMs`/
  `nextAutoSaveAttemptInMs`), `project` (checkout ownership +
  `dataJsonBytes`/`pdfBufferBytes`/`nearPdfCap`), `storage`
  (`navigator.storage.estimate`) + `lastLocalBackup`, and `visibility` on autosave
  events. Failed raw-fetch saves attach server request IDs via
  `extractResponseDiagnostics` (`requestId`/`cfRay`/`retryAfter`/`serverDate`) -- but
  those headers only surface if Supabase exposes them via `Access-Control-Expose-Headers`.
  Every serialized error carries a `transient` triage flag (`isTransientSaveError`).
  The envelope also carries `projectRef` + an `analysisNote` so that exported logs
  are self-describing: **when handed exported save logs, cross-reference each
  failure event with the project's Supabase server logs (Supabase MCP `get_logs`
  service `"api"`, or the dashboard Logs Explorer) by timestamp + path +
  `status_code` (and `tabSessionId`/`user.email`)** -- the authoritative
  `sb-request-id` lives server-side and is not browser-readable (CORS), so it is
  absent from the client events.
- Sharing uses checkout/turn-in (one editor at a time, 30-minute inactivity expiry
  with keep-alive). Admins can force turn-in. Expiry surfaces a recovery modal with
  silent auto-recheckout under it. Symbols: `doTurnIn`,
  `subscribeToProjectCheckoutChanges`, `refreshProjectPermissions`,
  `handleBackgroundCheckoutExpired`, `openCheckoutExpiredRecoveryModal`.

### Hotkeys

M (Move), S (Set Scale), C (Counter), L (Line modal), J (Snap to H/V), P
(Polyline), D (Measure), H (Highlight), X (Multiply Zone), N (Note), R (Rotate
page); Shift+Q open Quick tab (Counter or Choose Line Type modal); arrows: Left/Right page nav
(Shift = marked-page jump), Up/Down canvas layers; Ctrl+Z / Ctrl+Shift+Z
undo/redo; Ctrl+R refresh. Ignored when focus is in an input/textarea/contenteditable.

### Shared UI patterns

- **Line color modal**: `showLineColorModal(currentColor, onApply)` — used for
  Counters, Line Types, Groups, Lines (Presets / picker / Recent).
- **Toggle switches**: `.toggle-switch` + `.toggle-switch-knob` — used for Show
  group colors, Counter Settings (Show ring, Solid ring), Save Project Include PDF,
  Export PDFs (Bundle highlights/notes, Include report).
- For the full modal/feature inventory and exact symbols, see
  [ARCHITECTURE.md](ARCHITECTURE.md) "Features Beyond Spec".

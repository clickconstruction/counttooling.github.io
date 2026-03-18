# ClickCount — Code Map for AI Navigation

Use this file to locate code when `index.html` exceeds context window limits. Update line ranges when making large structural changes.

## File Overview

| File | Lines | Purpose |
|------|-------|---------|
| index.html | 1–1050 | HTML structure (head, body, modals) |
| index.html | 15–260 | CSS (design tokens, layout, modals, sidebar-item.active, mobile, page-zoom-row) |
| index.html | 1051–7466 | JavaScript (IIFE) |
| report.js | 1–439 | Print report, Summary (Item/Total/Pages; line types as `[unit] of [name]`, total numeric; `pickScaleForLineType` prefers ft; line totals use `getLineLengthPdfPts` for drops), getPipeToolingSummary(options), getEmailTextSummary(options) with `pageIndices` and `getAnnotations`; escapeHtml; uses globals from index.html |

## index.html Section Map

| Section | Lines | Contents |
|---------|-------|----------|
| Constants | 1047–1607 | TOOL, SCALE_MODES, uid, COLORS (9, no white), icon paths, SCALE_CROSSHAIR_PATH, COUNTER_BTN_DEFAULT_SVG, ICONS array |
| State & makeAnnotations | 1608–1750 | state object (counterSettings, lineTypeSettings, exportSettings, recentLineColors, pagesListCollapsed, pagesTitlesTruncated, touchPanStart, touchPanning, pendingCanvasLoad, isPanning, panStart), makeAnnotations(), undoStack, redoStack, pushUndoSnapshot, clearUndoStacks |
| Math & Format Helpers | 1728–1977 | ptDist, polylineDistance, polygonArea, distToSegment, getPageScale, formatDist, formatArea |
| Coordinate Helpers | 1978–1989 | getClientCoords, canvasRect, toCanvas, pdfPos, canvasToPdf, hitTest, renderIconHtml |
| PDF Rendering | 1990–2340 | renderPdf, renderAnnotations (scale crosshair, quick line preview, line selection highlight, X markers for drops), getPageSize, fitZoom |
| UI Render Functions | 2341–2939 | updateUI (scale-set, counterBtn/counterBtnSidebar dynamic icon, headerActiveLineType; headerActiveCounter cleared), renderPagesList, renderCountersList, renderLineTypesList, renderLinesList, renderSummary |
| Modals & Handlers | 2940–5100 | PDF upload, scale, move, quick line, polyline, counter (Create/Choose tabs), line type, counterSettingsModal, lineTypeSettingsModal, lineColorModal, specificPagesModal, pipeToolingCopiedModal, noteModal (Add/Edit Note), setScaleFirst toasts, chooseLineTypeModal, clearPageConfirmModal, deletePageConfirmModal, counterLineTypeDetailsModal, deleteCounterLineTypeConfirmModal, linePropertiesModal (Line Properties: Name, Color, Start/End drop, +1/+10/-10/-1/Clear, Edit vertices for polylines), authModal, settingsModal (Project Settings), shareProjectModal (Share: add users by email, list/remove shares, View links: create, copy URL, access log, revoke), mySettingsModal (User Settings), adminPanelModal, manageUserModal (list/delete users), manageProjectsModal (list/delete projects, Force turn-in per row), saveProjectModal (contents list: Canvas, PDF with size in MB from state.pdfBufferSize or pdfCache/storage.info; fallback when state.pages.length > 0; "Canvas only" when no PDF), loadProjectModal, loadAnnotationsModal, saveBeforeLoadModal, lastSessionRestoreModal (local backup first, key `'local'` when Open without save; cloud project when no local; proj.id `'local'` → state.currentProjectId null; on boot when last.projectId exists; proj.pdf_hash for cache when last.pdfHash null; download() with empty-blob check; hasIdbPdf requires pdfBlob.size > 0; Keep/Discard), summaryCountDetailModal (— by page), settingsAdvancedSection, macrosModal (Keyboard Shortcuts), customIconTipsModal (Custom Icon Tips; click Custom Icons label), preparePdfModal (Prepare PDF for Cloud: Project name, Page name collapsible, Prev/Next, Delete, Rotate, Undo; left: Cancel, Open; right: Download Trimmed PDF, Save and Open; Open awaits writeTakeoffStateBackup; per-page file size) |
| Canvas Event Handlers | 5088–5220 | handleCanvasClick, handleCanvasDblClick, handleContextMenu |
| Event Binding | 5221–5749 | updateContainerTransform, wheel zoom (debounced), touch (handleTouchAsCanvasTap for LINE/HIGHLIGHT/NOTE, preventDefault on touchend), keyboard (Escape, arrows: Left/Right page nav, Up/Down canvas layers when multiple; Enter; hotkeys M/S/C/L/J/P/D/H/N/R when not in input/textarea; Ctrl+R Refresh) |
| Init & Persistence | 5221–6948 | initSupabaseAuth, localStorage restore, save interval (5s backup), performAutoSave (5s when dirty), markProjectDirty, autoSaveDirty, lastSaveIncludedPdf, savePdfInProgress, pdfCachePut/Get, sha256Hex, clickcount-last-project restore (prompts Keep/Discard via lastSessionRestoreModal before restore), visibilitychange backup, backupDebounceTimer (1s after markProjectDirty), initViewOnlyMode, viewCacheGet/viewCachePut, window globals |

## Search Hints (grep patterns)

| To find | Pattern |
|---------|---------|
| Section markers | `SECTION:` or `SECTION: PDF Rendering` |
| PDF upload / size limit | `pdfInput` or `PDF_MAX_SIZE_BYTES` |
| PDF render logic | `function renderPdf` |
| Annotation drawing | `function renderAnnotations` |
| Export PDFs | `specificPagesModal` or `renderAnnotationsToContext` |
| Scale modal | `scaleModal` or `scaleSet` |
| Out-of-bounds toast | `outOfBoundsModal` or `showOutOfBoundsToast` — toast when click is outside page bounds (Scale, Measure, Line, Highlight, Polyline) |
| Scale crosshair | `SCALE_CROSSHAIR_PATH` |
| Per-page scale | `getPageScale` or `page.scale` |
| Counter creation | `counterBtn` or `addCounter`; `counterCreate` |
| Counter settings | `counterSettingsModal` or `counterSettings` |
| Line type settings | `lineTypeSettingsModal` or `lineTypeSettings` |
| Line color modal | `lineColorModal` or `showLineColorModal` |
| Line type creation | `addLineType` or `lineTypeCreate` |
| Polyline drawing | `drawingPolyline` or `finishPolyline` |
| Line selection | `selectedLineId` or `selectedLinePageIdx` |
| Canvas click handling | `handleCanvasClick` |
| Zoom/pan | `state.zoom` or `updateContainerTransform` or `lastRenderedZoom` |
| hitTest | `function hitTest` |
| Coordinate conversion | `canvasToPdf` or `toCanvas` |
| Rename | `startRename` |
| Pages collapse | `pagesListCollapsed` or `pagesSection` |
| Download current page | `downloadCurrentPageBtn` or `downloadCurrentPageAsPdf` |
| Mobile sidebar tools | `sidebar-tool-buttons` or `moveBtnSidebar` |
| Mobile header tools | `sidebar-triggers` (Move, Counter, Line visible; Polyline hidden); `has-pdf` (body class; Upload PDF vs Set Scale slot) |
| Header active type | `headerActiveLineType`; counter icon on `counterBtn`/`counterBtnSidebar` when counter selected; `headerActiveCounter` cleared |
| Counter button dynamic icon | `counterBtn`, `counterBtnSidebar`, `COUNTER_BTN_DEFAULT_SVG`, `iconVbFor` |
| Toggle switches | `toggle-switch`, `toggle-switch-knob`; used for Show group colors, Counter Settings (Show ring, Solid ring), Save Project Include PDF, Export PDFs (Bundle highlights, Bundle notes, Include report) |
| Counter modal tabs | `counter-tab` or `counterChooseList` |
| Page/zoom row | `page-zoom-row` |
| Page rotation | `rotatePage90` or `rotatePage` or `page.rotation` |
| Counter/Line Type details modal | `openCounterLineTypeDetailsModal` or `counterLineTypeDetailsModal` |
| Supabase auth | `initSupabaseAuth` or `state.supabaseSession` |
| Dev auth bypass | `canUseDevAuth` or `devAuthSignIn`; `?devAuth=1` URL param (localhost) or "Sign in as test user" in auth modal; requires `DEV_AUTH_EMAIL` and `DEV_AUTH_PASSWORD` in config.js |
| Save/Load project | `saveProjectModal` or `loadProjectModal` |
| Share project | `shareProjectModal` or `openShareProjectModal`; invite-to-project Edge Function; Share modal includes View links section (create, list, copy URL, access log, revoke) |
| Checkout | `check_out_project`, `check_in_project`, `force_check_in_project` RPCs; `state.isViewer`, `state.canCheckOut`; `subscribeToProjectCheckoutChanges`, `refreshProjectPermissions` for realtime |
| Save before load | `saveBeforeLoadModal` or `openLoadProjectModalOrPromptSave` |
| Turn In | `tryTurnIn`, `doTurnIn` — canvas-only save (performAutoSave) + check_in_project; PDF upload skipped on turn-in; toast when PDF still local |
| Pages title truncation | `formatPageTitleStartEnd`, `pagesTitlesTruncated` |
| Last session restore | `lastSessionRestoreModal` or `pendingLastSessionRestore` or `doRestoreLastProject` — local backup key `'local'`; checked first; init requires only `last.projectId`; uses `proj.pdf_hash` for cache when `last.pdfHash` null; Supabase restore uses `download()` with empty-blob guard; doRestoreLastProject uses `userId` not `uid` (avoids shadowing) |
| Load annotations (hash match) | `loadAnnotationsModal` or `loadAnnotationsList` or `loadAnnotationsSkip` |
| Canvas-only load flow | `pendingCanvasLoad` |
| PDF hash computation | `sha256Hex` |
| Status bar indicators | `updateStatus` or `statusBarDot` or `statusBarSquare` |
| Pages badges | `badge-scale-set` or `badge-has-ann` or `renderPagesList` |
| Marked page nav | `getMarkedPageIndices` or `prevMarkedPage` or `nextMarkedPage` |
| View links / initViewOnlyMode | `initViewOnlyMode` or `get-view-project` or `viewCacheGet` |
| Auto-save | `performAutoSave` or `markProjectDirty` or `autoSaveDirty` |
| Project Settings Advanced | `settingsAdvancedSection` or `settingsAddAdditionalPages` or `settingsLoadTestPdf` (localhost only) |
| Prepare PDF modal | `preparePdfModal` or `openPreparePdfModal` or `commitPreparePdfToState` or `preparePdfDownload` or `downloadPdfBuffer`; Page name collapsible; Rotate (90°; `preparePdfRotatePage90`); per-page file size (`preparePdfPageBytes`); Download Trimmed PDF, Save and Open on right; `trimmedBuf.slice(0)` passed to getDocument to avoid buffer detachment; `state.pdfBufferSize` set before `pdfjsLib.getDocument()` because pdf.js detaches buffer |
| Admin panel | `adminPanelModal` or `adminCreateUser` |
| Manage User modal | `manageUserModal` or `openManageUserModal` or `deleteUser` |
| Manage Projects modal | `manageProjectsModal` or `openManageProjectsModal` or `deleteProject` or `forceCheckInProjectFromManage`; Force turn-in (admin) per checked-out row; opened via `settingsManageProjects` in Project Settings |
| Manage Icons modal | `manageIconsModal` or `openManageIconsModal`; opened via `settingsManageIcons` in Project Settings; edit icon display names; Custom icons section with Edit/Delete selected for uploaded icons; `getIconName(path)` |
| User Settings | `mySettingsModal` or `openMySettings` — email, change password, Artboard (Save/Load/Export counters and line types to user profile), Add User / Manage User (admin), All Users list (admin), Sign Out; `mySettingsSaveAirboard`, `mySettingsLoadAirboard`, `mySettingsExportAirboard` |
| Project Settings gear | `settingsGearBtn` or `header-settings-gear` — top right on desktop; opens settingsModal |
| Project Settings | `settingsModal` — Name / Upload / Save Project to Cloud, Load Project from Cloud, Close Project, Check out Project / Turn In Project / Force Turn In (admin only), Share, Add additional PDF pages, Download PDF, Advanced (collapsed) with Manage Icons, Export Canvas, Export PDF (when PDF in project; both available in view mode), Import Canvas (hidden in view mode), Load test PDF (localhost only) |
| Export PDFs modal | `specificPagesModal` or `openSpecificPagesModal` — thumbnails, per-page marked/unmarked/exclude, bulk actions, Include takeoff report / Bundle highlights / Bundle notes with "— none to show" when no data |
| Copy to PipeTooling | `forPipeToolingDropdown` or `getPipeToolingSummary` — dropdown (drop-up); options: This Canvas Only, All Visible Canvases, All Canvases |
| Copy Summary (Email/Text) | `copySummaryTextDropdown` — dropdown with same options; pops up when no space below |
| Copy view link button | `copyViewLinkBtn` — header left of gear; copies view link (creates if none); hidden when viewer |
| Summary count detail modal | `summaryCountDetailModal` or `openSummaryCountDetailModal` — "— by page" breakdown with thumbnails when clicking count/line in Summary |
| Legend / Summary overlay | `showLegendOverlay` or `legendSettingsModal` or `drawLegend` or `userResized` |
| Undo/Redo | `undoBtn`, `redoBtn` — bottom bar next to rotate; `undoStack`, `redoStack`, `pushUndoSnapshot`, `clearUndoStacks`; Ctrl+Z / Ctrl+Shift+Z |
| Middle mouse pan | `e.button === 1`; `state.isPanning`, `state.panStart`; `moveCursorSvg` during pan |
| Show Highlights / Show Notes | `bundleHighlights` or `bundleNotes` or `addHighlightsToPdf` or `addNotesToPdf` or `hasAnyNotes` |
| Note modal | `noteModal` — Add/Edit Note (textarea, Cancel/Done); double-click or context Edit to edit |
| Choose Line Type modal | `chooseLineTypeModal` — tabs: Choose Line Type / Create Line Type (like Counter modal) |
| Macros / Keyboard Shortcuts | `macrosModal` or `statusBarMacros` — modal listing M/S/C/L/J/P/D/H/N/R/Esc/arrows (Left/Right page, Up/Down canvas when multiple)/Enter/Ctrl+Z/Ctrl+Shift+Z/Ctrl+R shortcuts |
| Custom icon upload | `customIconUploadInput`, `customIconTipsModal`, `getUserCustomIcons`, `saveUserCustomIcons`, `parseUploadedSvg`; Custom Icons grid has + Upload cell; Manage Icons Custom icons section: Edit/Delete selected; click "Custom Icons" label for tips |
| Line drops / Line Properties | `startDrop`, `endDrop` on quick lines and polylines; `getLineLengthPdfPts`; `linePropertiesModal` or `openLinePropertiesModal`; `ctxLineProperties` in context menu; X markers when drop > 0 |
| Snap to H/V header button | `lineTypeSnapToHVHeaderBtn` — in header right of Polyline; visible when Line or Polyline tool selected; J hotkey |

## Key Globals (used by report.js)

These must remain on `window`: `state`, `makeAnnotations`, `ptDist`, `polylineDistance`, `formatDist`, `renderIconHtml`, `getLineLengthPdfPts`, `getMergedAnnotationsForPage`. Report.js also exposes `buildReportHtml`, `printReport`, `getPipeToolingSummary`, `getEmailTextSummary`. Both summary functions accept optional `options`: `{ pageIndices?: number[], getAnnotations?: (page) => annotations }`.

## Data Flow

```
Events → handlers → state updates → renderPdf() / renderAnnotations() / updateUI() → DOM
```

- Annotations stored in PDF-space (zoom-independent)
- Scale is per-page: `page.scale`; use `getPageScale(pageIdx)` to read
- `canvasToPdf(x,y)` converts wrapper coords to PDF; `toCanvas(p)` converts PDF to canvas pixels (includes dpr)

## Layout

- **Desktop header**: Logo and tools (Measure, Highlight, Note, Move, Counter, Line, Polyline, Snap to H/V when Line or Polyline selected) on left; spacer; Copy view link button (left of gear) and settings gear (Project Settings) in top right when Supabase enabled; Download current page (yellow cloud icon, far right) when PDF loaded; primary buttons (Sign In, Save, Load, etc.) hidden in header, shown in status bar
- **Mobile header** (max-width: 768px): Hamburger, Upload PDF (when no PDF, transparent/text-only) or Set Scale (when PDF and no scale), Measure, Highlight, Note, Move, Counter + active counter icon, Line + active line type color swatch (Polyline and Done Editing hidden); `body.has-pdf` toggled in updateUI; Set Scale hidden when scale set; "Line" not "Quick Line"; header z-index 250; settings gear hidden (access via sidebar logo)
- **Sidebar** (slide-in): ClickCount logo + User/Settings icons (mobile; User and Project Settings buttons hidden on mobile as redundant), Upload PDF / Set Scale (button shows "Scale 1 ft = X" when set), Name / Upload / Save Project to Cloud / Load Project from Cloud (when Supabase enabled), Export Canvas / Import Canvas, Move / Counter / Quick Line / Polyline / Done Editing, Pages, Counters, Line Types, Lines, Summary, Show Report, Export PDFs, Copy to PipeTooling, Copy Summary (Email/Text), Show Highlights, Show Notes (when data exists), Clear Page
- **Bottom bar** (page/zoom row): Page nav, zoom controls, rotate, Undo, Redo
- **Status bar**: Dual indicators (circle=canvas, square=PDF), project/sync status, Sign In (when Supabase), Macros (keyboard shortcuts modal), Clear Page
- **Touch**: Single-finger pan, pinch-to-zoom, long-press (500ms) for context menu; `touch-action: none` on canvas; `handleTouchAsCanvasTap` for LINE, HIGHLIGHT, and NOTE modes (direct touch, no synthetic click); `preventDefault` on touchend to avoid ghost click double-placement; 25px movement threshold for LINE/POLYLINE taps
- **Scale taps**: 400ms debounce to avoid double-tap on mobile

## Features Beyond Spec (RECONSTITUTE.md)

- **Move button** — Header button toggles active when `state.tool === TOOL.NONE`; left of Line; visible in header on mobile
- **Set Scale button** — Dynamic: "Set Scale" when no scale; "Scale" + "1 ft = X" when set; opens scale modal for current page; clicking clears scale marks and closes modal (restart); hidden in header when scale is set (desktop and mobile); on mobile: Upload PDF shown in header when no PDF; Set Scale shown when PDF loaded and no scale; sidebar button shows scale value when set (no separate scale display above it)
- **Per-page scale** — Each page has `page.scale`; Set Scale only affects current page; `getPageScale(pi)` helper
- **Scale crosshair** — Plus icon at scale point A/B when setting scale
- **Scale toasts** — "Set Scale first to use Quick Line" / "Set Scale first to use Polyline" (3s auto-dismiss, Escape to close)
- **Choose Line Type modal** — When Line/Quick Line clicked with no line types or no active line type; tabs: Choose Line Type / Create Line Type (like Counter modal); empty state: "Add a line type first using **Create Line Type**"
- **Counter modal** — Tabs: Choose Counter (default), Create Counter; Choose Counter lists existing counters to select; Create Counter for new counter; selected icon outlined with accent; color palette 9 colors (no white)
- **Custom icon upload** — Custom Icons grid in Create Counter and Counter Details modals; + Upload cell triggers file input; SVG parsed for path/rect/circle/ellipse/line; user icons in localStorage `customIconPaths`; included in export/import; click "Custom Icons" label to open tips modal (simple shapes, single color, path-based, avoid transforms, square viewBox); Manage Icons modal has Custom icons section with Edit mode to select and Delete selected
- **Line button restart** — When drawing a line (quickLineStart set), tap Line again to clear start point and restart
- **Header active type** — Counter button and sidebar Counter button show the selected counter's icon and color (with black outline) when counter tool is active and a counter is chosen; otherwise default ellipse; `headerActiveCounter` span cleared (no longer used); line type color swatch next to Line when active (mobile)
- **Page/zoom row** — Page nav and zoom bar in same row; zoom bar to the right of page bar
- **Add line type first** — Shown in Choose Line Type modal when no line types exist
- **Clear Page confirmation** — Modal "Are you sure?" with Cancel and Clear Page (danger)
- **Export PDF** — Show Report dropdown (four options: this canvas only, all canvases on page, all plan pages current canvas, all pages and canvases; each opens report in new window); Export PDFs (modal: marker/line size sliders 25–150%, thumbnails, per-page marked/unmarked/exclude, bulk actions All Marked Up / All Not Marked Up / Exclude All, Include takeoff report / Bundle highlights / Bundle notes toggle switches with "— none to show" and disabled when no data); Copy to PipeTooling (dropdown, drop-up, yellow primary button; options: This Canvas Only [hidden when single page], All Visible Canvases, All Canvases; copies tab-delimited summary via `getPipeToolingSummary(options)`; fixture, count, page; counters and line types with `[unit] of [name]` format; shows "Copied to clipboard" toast); Copy Summary (Email/Text) (dropdown with same options; pops up when no space below); Show Highlights, Show Notes (open in new tab; hidden when no data); uses jsPDF; original page dimensions preserved; filenames: `takeoff-specific-pages_[project name].pdf`, `highlights-summary_[project name].pdf`, `notes-summary_[project name].pdf`
- **Download current page** — `#downloadCurrentPageBtn` in header (far right); yellow cloud-download icon; one-click download of current page as marked PDF; visible in edit and view mode when PDF loaded; `downloadCurrentPageAsPdf()`; uses `renderAnnotationsToContext`, jsPDF; filename `takeoff-page{N}_{projectName}.pdf`
- **Download PDF** — Project Settings "Download PDF" button downloads the current project's PDF as-is (from `state.pdfBuffer` or Supabase storage); Prepare PDF modal "Download Trimmed PDF" (right side) downloads the trimmed PDF (kept pages only; rotation stored in state on commit); `downloadProjectPdf()`, `downloadPdfBuffer()`
- **Counter Settings** — Click "Counters" heading: icon size (12–96px), opacity, number size, outline (black SVG stroke), show ring (size, opacity, solid); Show ring and Solid ring use toggle switches; Ring section only visible when "Show ring around counters" on; solid ring default true; all persisted
- **Line Type Settings** — Click "Line Types" heading: opacity, line size, drop X size (4–24px), drop icon (Circle default, X, Plus, Diamond, Triangle), Orient length with line direction toggle, Parallel ends (4–64px), Length label size (8–24px), Snap to horizontal/vertical toggle; snap icon in header (right of Polyline button; visible when Line or Polyline selected) and J hotkey toggle same setting
- **Line Color modal** — Shared for Counters, Line Types, Lines: native color picker + recent colors (max 12); `showLineColorModal(currentColor, onApply)`
- **Quick line color** — Lines sidebar: click swatch to change color; quick lines and polylines support per-line color
- **Quick line preview** — Line renders from first click to second while placing
- **Quick Line Escape** — First Escape removes first point; second Escape exits to Move mode
- **Line selection highlight** — Click line in Lines sidebar: `selectedLineId`, `selectedLinePageIdx`; selected line drawn thicker with glow on canvas
- **Rename** — Edit buttons on pages, lines; Escape cancels (reverts); arrow keys move cursor in input; counters and line types: edit pen opens counterLineTypeDetailsModal with Name field
- **Line type layout** — Two-row: name on top, swatch + runs/length + edit on bottom
- **Lines layout** — Name on top, length below (with drops e.g. "5 + 3 ft" when present), swatch + edit on bottom; click to select/highlight on canvas; edit pen or double-click opens Line Properties modal
- **Selection highlight** — `.sidebar-item.active` for selected counter, line type, line, and current page in Pages list
- **Toggle switches** — `.toggle-switch` with `.toggle-switch-knob`; used for Show group colors (Groups section), Counter Settings (Show ring, Solid ring), Save Project Include PDF, Export PDFs (Bundle highlights, Bundle notes, Include report); button toggles hidden checkbox, syncs `aria-pressed`
- **Highlight annotation** — Two-click low-opacity rectangular highlight on PDF; H hotkey; context Delete; Bundle Highlights PDF; `page.annotations.highlights`
- **Page annotation notes** — Note tool (N hotkey); click to place, modal for text; red text; fixed-size on screen; resizable width (draggable handle) with text wrap; square size slider (left side) for font size; moveable after placement; anchor dot slightly left of text; double-click or context Edit to edit; context Delete; Notes section in Print Report; Bundle Notes PDF
- **Hotkeys** — M (Move), S (Set Scale), C (Counter), L (Quick Line), J (Snap to horizontal/vertical), P (Polyline), D (Measure), H (Highlight), N (Note), R (Rotate page); Ctrl+R / Cmd+R (Refresh); arrow keys: Left/Right = page nav, Up/Down = switch canvas layers (when page has multiple canvases; no-op when single); ignored when focus is in input/textarea/contenteditable (Escape still closes modals)
- **Tool switching on click** — Clicking a line type switches to Quick Line mode; clicking a counter switches to Counter mode
- **New counter/line type selected by default** — Newly created counter or line type becomes active immediately
- **Macros** — Status bar "Macros" link opens Keyboard Shortcuts modal (M/S/C/L/J/P/D/H/N/R/Esc/arrows: Left/Right page, Up/Down canvas/Enter)
- **Scale badge** — Page number in Pages: `.badge-scale-set` = yellow number when scale set; `.badge-has-ann` = yellow outline when page has counts, lines, notes, or highlights
- **Pages collapse** — Click "Pages" heading toggles `pagesListCollapsed`; `#pagesSection.collapsed` hides list; Pages section auto-collapses when user selects a counter or line type
- **Sidebar collapse hit area** — Clicking the collapse icon (▼/▶) or the black space next to it minimizes the section; `.collapse-icon` in sidebar has expanded padding for larger hit area; Groups and Lines sections start minimized by default
- **Pages title truncation** — Long page titles show start (ending in `...`) on line 1 and end (starting with `...`) on line 2; `formatPageTitleStartEnd`, `pagesTitlesTruncated` (default true); click "Pages" heading toggles truncation; persisted in localStorage
- **Page edit/delete** — Edit (yellow icon) and delete (red icon) per page; delete shows confirmation modal with page name; edit icon hidden while editing
- **Default project title** — On PDF upload, `state.currentProjectName` set from filename minus `.pdf`
- **First page on upload** — When uploading PDF, first page of added PDF is selected by default
- **Status bar** — Dual indicators: circle (dot) = canvas sync, square = PDF sync; each has a label next to it (e.g. "Canvas Synced with Cloud", "PDF Synced with Cloud", "PDF No PDF in project"); both use red/yellow/green/grey; messages: "Project not saved to cloud", "Upload PDF to start a project" (no PDF); Name / Upload / Save Project to Cloud / Load Project from Cloud; save progress during upload; show report, combined PDF hidden when no counts or lines; tool hints appended when in active tool mode
- **Zoom** — Range 0.2–800%; CSS scale during wheel; debounced PDF re-render; translate3d for pan
- **Marked page navigation** — ‹‹ and ›› buttons outside page nav; jump to previous/next page with annotations; yellow text and border when selectable
- **Project Settings Advanced** — Collapsed by default; contains Load test PDF (localhost only), Manage Icons, Export Canvas, Export PDF (when PDF in project; both available in view mode), Import Canvas (hidden in view mode)
- **Add additional PDF pages** — In Project Settings when PDF uploaded; opens preparePdfModal (Prepare PDF for Cloud): Project name, Page name (collapsible dropdown minimized by default, icon ▶ at end, whole line clickable), Prev/Next, Delete, Rotate (90° per page), Undo; left: Cancel, Open; right: Download Trimmed PDF, Save and Open; per-page file size; commitPreparePdfToState; Upload PDF hidden in title bar
- **Conditional sidebar visibility** — Show Highlights, Show Notes, Copy to PipeTooling, Copy Summary, Show Report, Export PDFs hidden when no data; "This Canvas Only" option hidden in both dropdowns when single page
- **Export Options** — Yellow section title above Export PDFs in sidebar (`#exportOptionsSectionTitle`); Copy to /Tooling is the yellow (primary) button
- **Supabase Phase 1 & 2** — Admin-provisioned auth (Sign In only), Add User / Manage User (admin creates and deletes accounts) in User Settings, Manage Projects (admin lists and deletes projects) in Project Settings, Name / Upload / Save Project to Cloud / Load Project from Cloud; save modal includes "Include PDF in this save" toggle and contents list (Canvas, PDF with size in MB); size from `state.pdfBufferSize` or pdfCache/storage.info; `state.pdfBufferSize` captured before getDocument since pdf.js detaches buffer; "Canvas only" badge for projects without PDF; project name on top in Manage/Load modals; Load Project row: counts badge (X cnt · Y ln), Canvas only badge when no PDF, Delete; list_accessible_projects (migration 030 adds counter_count, line_count); save-before-load prompt when loading with unsaved changes; auto-save every 5 seconds when dirty (signed-in: Supabase; unsigned: localStorage); 5-second localStorage backup; PDF IndexedDB cache on save; last-project restore from `clickcount-last-project`; `profiles` and `projects` tables (`pdf_path`, `pdf_hash`, `size_bytes`); `pdfs` storage bucket; Edge Functions `admin-create-user`, `admin-delete-user`, `admin-delete-project`, `admin-list-users`, `invite-to-project`, `get-view-project`; RPC `list_users_for_admin`, `list_projects_for_admin`; hash-based skip on upload; IndexedDB cache (10 projects, 500 MB); backup fetches `proj.pdf_hash` from Supabase when `last.pdfHash` is null, enabling cache lookup for last-project PDF; IndexedDB backup: local-only restore (key `'local'`) when Open without save; local backup checked first on boot; visibilitychange and debounced backup (1s after dirty) for annotation capture before tab close; config via `config.js` (SUPABASE_SETUP.md)
- **Dev auth bypass** — `?devAuth=1` URL param (localhost) or "Sign in as test user" in auth modal; `canUseDevAuth()`, `devAuthSignIn()`; requires `DEV_AUTH_EMAIL` and `DEV_AUTH_PASSWORD` in config.js; for automated testing
- **View links** — Share modal "View links" section: create, list, copy URL, access log, revoke; URL `?t=TOKEN`; `get-view-project` Edge Function (no JWT); email domain gate (clickplumbing.com); `viewCacheGet`/`viewCachePut` for IndexedDB; `viewLinkEmailModal`; `initViewOnlyMode(viewToken)` on boot when `?t=` present
- **PDF size limit** — When Supabase is enabled, PDF uploads over 50 MB are rejected with an alert (Supabase storage limit)
- **Artboard** — In User Settings (Supabase): Save Artboard, Load from Cloud, Export Artboard; saves counters and line types to user profile; `mySettingsSaveAirboard`, `mySettingsLoadAirboard`, `mySettingsExportAirboard`
- **Page rotation** — Per-page `page.rotation` (0/90/180/270); rotate button (↻) in zoom bar next to zoom controls; `rotatePage90()`, `rotateAnnotations()`, `rotatePoint90CW()`; annotations transform on rotate; notes text rotates with page; persisted in save/load
- **Counter/Line Type details modal** — Edit pen (✎) on counter or line type row opens `counterLineTypeDetailsModal`; Name (editable), Color (swatch), On pages (clickable jump), Delete (count=0 immediate; count>0 confirm + remove markers/lines); row click selects for placing; `openCounterLineTypeDetailsModal`, `performDeleteCounterLineType`
- **Line drops** — Per-line `startDrop` and `endDrop` (page scale units) for vertical runs; X markers at endpoints when drop > 0; total length via `getLineLengthPdfPts`; Line Properties modal (edit pen or context menu "Line Properties"): Name, Color, Start drop, End drop, +1/+10/-10/-1/Clear buttons, Edit vertices for polylines; sidebar Lines list shows drops below length; persisted in save/load and export/import
- **Mobile sidebar redundancy** — User and Project Settings buttons hidden on mobile (`#authBtnSidebar`, `#settingsSidebarBtn`); icons in sidebar logo provide same access
- **Manage Projects Force turn-in** — Admin can force turn-in from Manage Projects modal per checked-out row; `list_projects_for_admin` returns `checked_out_by`, `checked_out_at`, `checked_out_email` (migration 025)
- **Realtime force turn-in notification** — When admin force turns in, user with project open gets toast "Project was turned in. You can check out to edit again." and UI switches to view mode via `refreshProjectPermissions`; `subscribeToProjectCheckoutChanges` on projects table
- **Turn In** — Button labeled "Turn In Project"; always does canvas-only save (performAutoSave when dirty) + check_in_project; PDF upload skipped; toast when PDF still local ("PDF saved locally—use Name / Upload / Save Project to add it to the project"); `withTimeout` on performAutoSave and check_in_project RPC to prevent hang
- **Copy view link button** — Header button left of gear; copies most recent view link (creates if none); hidden when viewer; `.copied` class for feedback
- **View link create permission** — Only owners and editors can create view links; copyViewLinkBtn and shareViewLinkCreate hidden when `state.isViewer`
- **Canvas browsing in View mode** — Viewers can switch active canvas via pills and layers dropdown; change is local (no markProjectDirty); Add canvas and Edit canvas remain restricted
- **Undo/Redo** — Last 5 moves in local memory; buttons in bottom bar next to rotate; Ctrl+Z / Ctrl+Shift+Z; cleared on load or when viewer
- **Middle mouse pan** — Hold middle mouse button to pan regardless of active tool; move SVG cursor during pan
- **Summary count detail modal** — Click count or line in sidebar Summary opens modal with page breakdown and thumbnails
- **Summary legend overlay** — Overlay on canvas showing counters and line totals; `state.showLegendOverlay` (default true); legend button toggles; draggable via header bar; resizable via bottom-right grip (16×16 hit area); Legend Settings: bg/text opacity, color, Show border, Legend size (50–400%), Highlight resize area; `ann.legend` has `{ x, y, w, h, userResized? }`; `userResized` preserves manual size across renders; window mousemove/mouseup for resize/drag when cursor leaves canvas
- **Copy Summary (Email/Text)** — Export Options dropdown (`#copySummaryTextDropdown`) with options: This Canvas Only (hidden when single page), All Visible Canvases, All Canvases; copies counts and lines as plain text for email/paste via `getEmailTextSummary(options)`; menu pops up when no space below

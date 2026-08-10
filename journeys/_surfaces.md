# Entry-point & modal surface inventory — Phase 1 (2026-08-02)

**71 modals** in app/index.html. Doc-derived; Phase 2 verifies.

## Desktop header (shared DOM with mobile; visibility flipped by CSS classes replaced-by-status-bar / consolidated-mobile / supabase-only)

- headerLogo (CountTooling wordmark, toggles sidebar)
- uploadPdf (+ hidden #pdfInput file input, multiple PDFs)
- Tool strip #setScale
- #moveBtn
- #measureBtn
- #highlightBtn
- #multiplyZoneBtn (right-click=settings)
- #scaleZoneBtn
- #roomBtn
- #deleteZoneBtn
- #noteBtn
- #legendBtn (right-click=settings)
- #gridBtn (right-click=settings)
- #counterBtn (right-click=settings) + headerActiveCounter chip
- #quickLine (right-click=Line Type settings) + headerActiveLineType chip
- #polylineBtn (right-click=Line Type settings)
- lineTypeSnapToHVHeaderBtn (snap 45°, conditional)
- doneEditing
- headerEditStatusBanner (display only)
- saveStatusBtnHeader (save-status bell; CSS-hidden on mobile)
- hideMarksBtn
- headerShareBtn
- copyViewLinkBtn
- settingsGearBtn
- authBtn (Sign In)
- saveProjectBtn
- loadProjectBtn
- manageUsersBtn
- exportBtn
- importBtn (+ hidden #importInput .json, #customIconUploadInput .svg)
- clearPage (danger)
- exportDropdownBtn + exportDropdownMenu (consolidated-mobile)
- downloadCurrentPageBtn + downloadCurrentPageMenu (consolidated-mobile)
- globalReloadBanner Reload / Dismiss buttons (top-of-page banner)

## Mobile header (same header element; mobile-specific controls)

- hamburger (#hamburger, opens sidebar as drawer — mobile-only)
- headerBurger (#headerBurger, opens right-side burger drawer #rightMenu)
- consolidated icon buttons: hideMarksBtn, headerShareBtn, exportDropdown, downloadCurrentPageDropdown (class consolidated-mobile)
- text buttons with class replaced-by-status-bar (auth/save/load/export/import/clearPage) are folded away on mobile

## Sidebar (left; drawer on mobile via #hamburger/#sidebarBackdrop)

- sidebarLogoUser (My Settings)
- sidebarLogoShare (Share)
- sidebarLogoGear (Project Settings)
- sidebarCheckoutBanner (checkout state display)
- uploadPdfSidebar
- setScaleSidebar
- authBtnSidebar
- settingsSidebarBtn
- saveProjectBtnSidebar
- loadProjectBtnSidebar
- manageUsersBtnSidebar
- exportBtnSidebar
- importBtnSidebar
- tool twins: measureBtnSidebar, highlightBtnSidebar, multiplyZoneBtnSidebar, scaleZoneBtnSidebar, roomBtnSidebar, deleteZoneBtnSidebar, noteBtnSidebar, legendBtnSidebar, gridBtnSidebar, moveBtnSidebar, counterBtnSidebar, quickLineSidebar, polylineBtnSidebar, doneEditingSidebar
- sidebarScaleDisplay (desktop-only scale readout)
- Pages: pagesSectionTitle (click=Page Settings modal; arrow collapses) + pagesList rows
- Counters: countersSectionTitle (click=Counter Settings), addCounter (+ Add), plumBtn (PLUM quick-add), counterSearchInput, counterShowOnlyOnPageInlineBtn
- Line Types: lineTypesSectionTitle (click=Line Type Settings), addLineType, plumLineBtn, lineTypeSearchInput, lineTypeShowOnlyOnPageInlineBtn
- Lines subsection: linesSectionTitle, linesSearchInput, linesShowOnlyOnPageBtn
- Groups: groupsSectionTitle, addGroup, groupsList, showGroupColorsBtn toggle
- Rooms: roomsSectionTitle + roomsList (shown when room boxes exist)
- Summary: summarySectionTitle + summaryList (rows open summaryCountDetailModal)
- Export Options: printReport (Show Report dropdown: this-canvas / all-canvases-on-page / all-pages-current-canvas / all-pages-canvases)
- specificPages (Export PDFs)
- forPipeTooling (Copy to /Tooling dropdown: this-canvas / visible / all)
- copySummaryText (Copy Summary dropdown: this-canvas / visible / all)
- bundleHighlights (Show Highlights)
- bundleNotes (Show Notes)
- links: Home (/), PipeTooling (pipetooling.com/bids?tab=counts), TakeoffTooling (takeofftooling.com)
- clearPageSidebar (danger)
- sidebarReorderBanner Finish-reordering button

## Footer / bottom bar (page-zoom-row under canvas)

- prevMarkedPage (‹‹)
- prevPage (‹)
- pageInfo (0/0 display)
- nextPage (›)
- nextMarkedPage (››)
- canvas switcher: canvasCurrentName, canvasLayersBtn (mobile-only, opens #canvasMenu dropdown incl. + Add canvas)
- canvasIndexDisplay
- showAllCanvasesBtn (peek all canvases; right-click chooses which via #canvasPeekMenu)
- canvasPills (per-canvas pills)
- addCanvasBtn (+)
- zoom bar: zoomOut (−), zoomPct (click toggles floating Zoom Rail #zoomRail: plus/minus/track/thumb/settings gear)
- zoomIn (+)
- zoomFit (⊡)
- rotatePage (↻)
- undoBtn
- redoBtn
- polylineFinishBar: finishPolyline, closePolygon
- banners: syncPausedBannerRetry (Retry now), canvasOnlyNeedsPdfBannerChoose (Choose PDF)

## Status bar

- statusBarDot + statusCanvasLabel (canvas/save indicator)
- statusPdfGroup square + statusPdfLabel (PDF upload state)
- statusMode (current tool/mode readout)
- statusCoords
- statusTotals
- statusWarmup (background page-render progress)
- statusBarQuickKeys ('keys' — opens Quick Keys modal; desktop-only)
- statusBarMacros ('macros' — opens Macros/Keyboard Shortcuts modal; desktop-only)
- statusBarAuth (Sign In link)

## Hotkeys (HOTKEYS table, hotkeys.js — see hotkeys field)

- 25 table rows: 5 Navigation + 20 Tools (see hotkeys list)
- plus number row 1–9,0 = Quick Keys counter/line-type bindings (features/quick-keys.js, outside the HOTKEYS table)

## Canvas right-click / long-press

- right-click on a mark opens #contextMenu: ctxEdit, ctxLineProperties (color/name/drops), ctxShowLength, ctxAssignGroup, ctxEditMultiplyZone, ctxEditScaleZone, ctxEditRoomBox, ctxDelete, ctxTargetNameRow (label)
- right-click while drawing polyline (>=3 pts) = close polygon; double-click = finish polyline
- right-click on a vertex in polyline edit mode = delete vertex
- double-click a note = edit note
- mobile: 500ms long-press synthesizes contextmenu; 280ms press-hold summons the aim loupe (#aimLoupe) for precise placement (mobile-only)

## Tool-button right-click (#toolContextMenu, features/tool-context-menu.js; desktop + tablet only)

- counterBtn/counterBtnSidebar/headerActiveCounter -> Counter Settings… / Add counter…
- quickLine/quickLineSidebar/polylineBtn/polylineBtnSidebar/headerActiveLineType -> Line Type Settings… / Add line type…
- multiplyZoneBtn(+Sidebar) -> Multiply Zone Settings…
- legendBtn(+Sidebar) -> Legend Settings…
- gridBtn(+Sidebar) -> Grid Settings…
- moveBtn/measureBtn(+Sidebar twins) -> Set / edit scale…
- no-settings tools (setScale, highlight, scaleZone, deleteZone, note, room, hideMarks) answer with a toast

## Burger drawer (#headerBurger -> #rightMenu, features/burger-menu.js)

- Show marks / Hide marks (mirrors hideMarksBtn)
- Save status (bell; ONLY mobile surface for it — header bell is CSS-hidden on mobile)
- Share (editor -> Share modal; signed-in viewer -> copy view link)
- Download section: one row per currently-visible download-page option
- Export section: one row per currently-visible export-dropdown option

## Marketing landing (/index.html)

- nav: Guides (/guides/), Open the app (/app/)
- hero: Open the app (/app/), 'Already have access? Sign in' (/app/?signin=1)
- tel:+15123600599 call links (x4: hero, FAQ x2, footer)
- FAQ links: PipeTooling (pipetooling.com)
- footer: Guides, PipeTooling, TakeoffTooling, Open the app, tel link

## Modals

| id | purpose | owner |
|---|---|---|
| `scaleModal` | Set/edit page scale (presets + two-point calibration); reused for scale zones | features/scale.js |
| `counterModal` | Choose/create counter picker (with Quick tab) | features/counter.js |
| `lineTypeModal` | Create Line Type form | features/choose-create-line-type.js |
| `polylineModal` | New Polyline — pick line type before drawing | app.js |
| `counterSettingsModal` | Counter list settings/reorder | features/counter-settings.js |
| `pageSettingsModal` | Page settings (title truncate, hide unmarked) | features/page-settings.js |
| `viewerScaleNoticeModal` | View-link session notice about scale | features/view-only.js |
| `zoomModal` | Zoom Settings (max zoom, speed) | features/zoom.js |
| `lineTypeSettingsModal` | Line-type list settings/reorder | features/line-type-settings.js |
| `legendSettingsModal` | Summary legend settings | features/legend-settings.js |
| `multiplyZoneSettingsModal` | Multiply Zone settings | features/multiply-zone-settings.js |
| `gridSettingsModal` | Grid overlay settings | features/grid.js |
| `specificPagesModal` | Export PDFs — pick pages/options | features/export-pdfs.js |
| `lineColorModal` | Shared color-selection picker (callback service) | features/line-color.js |
| `setScaleFirstModal` | Toast: set scale before measuring/drawing | app.js |
| `outOfBoundsModal` | Toast: click outside page bounds | app.js |
| `pipeToolingCopiedModal` | Toast: takeoff copied to /Tooling clipboard | features/output.js |
| `toolingScaleCheckModal` | Scale sanity check before Copy to /Tooling | features/output.js |
| `importCanvasAfterPdfModal` | Import canvas JSON after a PDF is loaded | features/import-clear.js |
| `airboardToastModal` | Toast for artboard messages | app.js |
| `macrosModal` | Macros / Keyboard Shortcuts list (rows generated from HOTKEYS; hosts Keyboard Map inline on desktop) | app.js |
| `quickKeysModal` | Quick Keys — bind number row to counters/line types | features/quick-keys.js |
| `keyboardMapModal` | Keyboard Map visual (mobile host, 769px breakpoint) | features/keyboard-map.js |
| `customIconTipsModal` | Tips for uploading custom SVG icons | app.js |
| `chooseLineTypeModal` | Choose/Create Line Type tabbed picker (Quick Line/Polyline) | features/choose-create-line-type.js |
| `noteModal` | Add/edit note | features/note.js |
| `multiplyZoneModal` | Multiply zone multiplier value entry | features/zone-modals.js |
| `deleteZoneModal` | Delete-area confirm with item preview | features/zone-modals.js |
| `roomBoxModal` | Room box create/edit (height + room assignment) | features/room-sizer.js |
| `roomEditModal` | Room rename/edit | features/room-sizer.js |
| `roomDeleteConfirmModal` | Room delete confirm | features/room-sizer.js |
| `linePropertiesModal` | Line properties (color, name, drops) | features/item-details.js |
| `clearPageConfirmModal` | Clear Page confirm | features/import-clear.js |
| `deletePageConfirmModal` | Delete page confirm | features/zone-modals.js |
| `counterLineTypeDetailsModal` | Counter/line-type details: rename, color, icon grid, per-page usage | features/item-details.js |
| `deleteCounterLineTypeConfirmModal` | Delete counter/line-type confirm | features/item-details.js |
| `groupModal` | Group create/edit | features/groups.js |
| `groupAssignModal` | Assign item to group | features/groups.js |
| `settingsModal` | Project Settings | app.js |
| `saveStatusModal` | Save Status log (sync health) | features/save-status.js |
| `settingsAdvancedModal` | Advanced project settings | app.js |
| `canvasRepairModal` | Canvas Repair (data fix-up) | features/canvas-repair.js |
| `manageIconsModal` | Manage Icons (incl. custom icon upload entry) | features/manage-icons.js |
| `mySettingsModal` | My Settings (sign-in state, artboard prefs) | features/my-settings.js |
| `paletteInsightsModal` | Palette Insights — cross-project counter/line-type usage | features/palette-insights.js |
| `authModal` | Sign In | app.js |
| `adminPanelModal` | Admin panel hub | features/user-admin.js |
| `manageUserModal` | Admin: manage a user (list/delete/activity) | features/user-admin.js |
| `deleteUserConfirmModal` | Admin: delete user confirm | features/user-admin.js |
| `transferProjectsModal` | Admin: transfer a user's projects | features/user-admin.js |
| `setPasswordModal` | Admin: set user password | features/user-admin.js |
| `userProjectsModal` | Admin: view a user's projects | features/user-admin.js |
| `allUsersModal` | Admin: all-users list | features/user-admin.js |
| `userActivityModal` | Admin: raw user activity event log | features/user-activity.js |
| `userActivityOverviewModal` | Admin: rich per-user activity overview | features/user-activity-overview.js |
| `manageProjectsModal` | Admin: Manage Projects list | features/manage-projects.js |
| `saveProjectModal` | Name/Upload/Save Project to Cloud (Include-PDF toggle) | features/save-project.js |
| `loadProjectModal` | Load Project from Cloud browser + filters | features/load-project.js |
| `copyProjectModal` | Copy/fork project | features/copy-project.js |
| `summaryCountDetailModal` | Per-page breakdown of one counter/line type | features/summary-detail.js |
| `shareProjectModal` | Share Project — people list, invites, view links | features/share-links.js |
| `saveBeforeLoadModal` | Save-before-load gate when switching projects | features/copy-project.js |
| `checkoutExpiredRecoveryModal` | Edit session (checkout) expired — recovery prompt | app.js |
| `lastSessionRestoreModal` | Restore last session prompt on boot | features/restore-last-session.js |
| `loadAnnotationsModal` | Load saved annotations when uploaded PDF hash matches | features/pdf-intake.js |
| `canvasOnlyNeedsPdfModal` | Project has annotations but no PDF — choose one | app.js |
| `preparePdfModal` | Prepare PDF — page picking/preview/append | features/prepare-pdf.js |
| `viewLinkEmailModal` | Email gate for view-link sessions | features/view-only.js |
| `addCanvasModal` | Add canvas layer | features/canvas-layers.js |
| `canvasDetailsModal` | Canvas rename/details | features/canvas-layers.js |
| `deleteCanvasConfirmModal` | Delete canvas confirm | features/canvas-layers.js |

## Hotkeys

- Left arrow — previous page (bespoke)
- Right arrow — next page (bespoke)
- Up/Down arrows — switch canvas when multiple canvases (bespoke)
- Shift+Left — previous marked page (bespoke)
- Shift+Right — next marked page (bespoke)
- M — Move mode (runner: moveReset; viewer-allowed)
- S — Set Scale (btn: setScale; viewer-allowed)
- C — Counter mode (btn: counterBtn)
- Shift+Q — Quick tab when Counter or Line Type modal open (bespoke)
- L — Quick Line mode (btn: quickLine)
- J — Toggle snap to 45° angles (runner: toggleSnap; viewer-allowed)
- P — Polyline mode (btn: polylineBtn)
- D — Measure Distance (btn: measureBtn; viewer-allowed)
- R — Rotate page (runner: rotatePage; viewer-allowed)
- H — Highlight mode (btn: highlightBtn)
- X — Multiply Zone mode (btn: multiplyZoneBtn)
- (no key) — Scale Zone, icon-only tool (bespoke doc row)
- V — Room Sizer mode (btn: roomBtn)
- N — Note mode (btn: noteBtn)
- Ctrl+Z — Undo (bespoke)
- Ctrl+Shift+Z — Redo (bespoke)
- Cmd/Ctrl+R — Refresh (bespoke)
- Space — Toggle sidebar, desktop only (bespoke)
- Esc — Close modal / Cancel (bespoke)
- Enter — Finish polyline / Exit edit mode (bespoke)
- 1–9, 0 — Quick Keys counter/line-type bindings (features/quick-keys.js; NOT in the HOTKEYS table)

## Platform notes

- HOTKEYS table has moved: it now lives in /hotkeys.js (split out of constants.js 2026-07-30 per its header comment); the task brief and older doc pointers naming constants.js are stale. app.js executes it, scripts/build-macros.js generates the Macros table rows in app/index.html from it, and the Keyboard Map derives from that generated table.
- Desktop-only surfaces: status-bar 'keys' (Quick Keys) and 'macros' links (class status-bar-desktop-only); Space = toggle sidebar; sidebarScaleDisplay (class scale-display-desktop); tool-button right-click context menu (desktop + tablet native contextmenu only — phone long-press wiring is a planned follow-up per tool-context-menu.js header); Keyboard Map renders inline inside macrosModal on desktop (>769px).
- Mobile-only surfaces: #hamburger (sidebar-as-drawer toggle); #headerBurger burger drawer (only mobile surface for Save Status — the header bell is CSS-hidden on mobile); canvasLayersBtn (class canvas-layers-mobile-only) opening #canvasMenu; aim loupe press-hold magnifier (280ms); 500ms long-press synthesizing the canvas context menu; keyboardMapModal as the mobile Keyboard Map host (<=769px).
- Header is one shared DOM for desktop and mobile: classes replaced-by-status-bar and consolidated-mobile flip which controls show per breakpoint — there is no separate mobile header markup.
- Non-modal floating surfaces NOT counted in the 71 modals: #contextMenu (canvas mark right-click), #toolContextMenu (tool-button right-click), #canvasMenu + #canvasPeekMenu (canvas layer dropdowns), #zoomRail (floating zoom slider toggled by clicking footer zoom-%), and the four in-place dropdown menus (Show Report, Copy to /Tooling, Copy Summary, Export/Download header dropdowns), plus banners (globalReloadBanner, syncPausedBanner, canvasOnlyNeedsPdfBanner, sidebarReorderBanner).
- Sidebar section titles are controls, not just labels: Pages/Counters/Line Types titles open their settings modals (page-settings, counter-settings, line-type-settings) in addition to collapsing.
- Open question for Phase 2 walk: burger-menu.js line 6 comment says a media query 'folds the header's PDF actions into the drawer, on desktop' — verify at which breakpoints the burger drawer is actually reachable and what it contains on desktop vs mobile.
- Open question for Phase 2 walk: several modals are referenced from multiple files (e.g. macrosModal by app.js + keyboard-map.js; multiplyZoneModal by zone-modals.js + multiply-zone-settings.js; lineTypeModal by choose-create-line-type.js + quick-line.js + app.js) — owner assignments above follow ARCHITECTURE's Files table where named, filename convention otherwise.
- Marketing landing at repo-root /index.html is a separate surface from the app shell at /app/index.html; guides live under /guides/ (28 articles, source markdown in content/guides/).

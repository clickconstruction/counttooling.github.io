# ClickCount — Agent Instructions

## Spec Reference

**RECONSTITUTE.md** (if present) is the base spec for behavior and data structures; otherwise see ARCHITECTURE.md. The app includes many extensions; see ARCHITECTURE.md "Features Beyond Spec" for the full list.

## Tech Constraints

- Vanilla HTML, CSS, JavaScript
- No build step; static deployment
- Single-file architecture: HTML + CSS + JS in `index.html`
- report.js loads after index.html and uses globals: `state`, `makeAnnotations`, `ptDist`, `polylineDistance`, `formatDist`, `renderIconHtml`; exposes `buildReportHtml`, `printReport`, `getPipeToolingSummary`
- jsPDF for Export PDF; html2canvas for report-to-PDF (Combined PDF, Specific Pages)
- Supabase (optional): Auth, projects table (`pdf_path`, `pdf_hash`, `size_bytes`), `pdfs` storage bucket, RPC `list_users_for_admin`, `list_projects_for_admin`; Edge Functions (`admin-create-user`, `admin-delete-user`, `admin-delete-project`, `admin-list-users`, `invite-to-project`, `get-view-project`); config via `config.js` (see SUPABASE_SETUP.md)
- **Supabase migrations**: When creating or modifying migrations in `supabase/migrations/`, always apply them via the Supabase MCP `apply_migration` tool (name: filename without .sql, query: file contents)

## Navigation

1. **Read ARCHITECTURE.md first** — Contains line ranges, section map, and feature list for index.html
2. **Use grep/semantic search** — For specific features, use the search hints in ARCHITECTURE.md
3. **Prefer targeted reads** — Use `read` with offset/limit when editing a known section instead of loading the full file

## Conventions

- Preserve existing patterns and structure
- Coordinates: annotations in PDF-space; use `canvasToPdf` / `toCanvas` for conversion (toCanvas includes devicePixelRatio)
- Do not remove or rename globals used by report.js
- **Scale is per-page**: `page.scale`; use `getPageScale(pageIdx)` to read; never use `state.scale`
- **Persisted settings** (localStorage): `counterSettings`, `lineTypeSettings`, `exportSettings`, `recentLineColors`, `iconNames`, `iconOrder`, `pageScales`, `specificPagesIncludeReport`, `bundleHighlightsToPdf`, `bundleNotesToPdf` (in exportSettings), `clickcount-last-project` (last-project restore metadata); include new fields in export/import when adding
- **Line color modal**: `showLineColorModal(currentColor, onApply)` — used for Counters, Line Types, and Lines
- **Supabase**: When enabled, `state.supabaseSession`, `state.isAdmin`, `state.currentProjectId`, `state.currentProjectName`; cloud features hidden when `SUPABASE_ENABLED` is false; PDF uploads limited to 50 MB (Supabase storage limit)
- **Modals**: Project Settings (gear, top right on desktop) — Save Project to Cloud, Load Project from Cloud, Close Project (hidden when no project), Check out Project / Save and Turn In Project / Force Turn In (admin only for force), Share (add users by email), Add additional PDF pages (when PDF uploaded), Advanced section (collapsed by default) with Manage Icons, Export Canvas, Import Canvas; User Settings (user icon) — email, password, Artboard (Save/Load/Export counters and line types to user profile), Add User / Manage User (admin), All Users (admin), Sign Out; Manage User modal — list users with Delete per row; Manage Projects modal — list all projects with Delete per row and Force turn-in (admin) per checked-out row; project name on top, date/time/size below, "Canvas only" badge for projects without PDF; Specific Pages modal — thumbnails, per-page marked/unmarked/exclude, bulk actions, Include takeoff report / Bundle highlights / Bundle notes checkboxes with "— none to show" and disabled when no data; loadAnnotationsModal — "You have saved annotations for this PDF. Load them?" with project list; shown on PDF upload when hash matches cloud projects; viewLinkEmailModal — "Enter your email to view these plans" for view-only share links; saveBeforeLoadModal — unsaved changes prompt (Save now / Don't Save / Cancel); when saving shows "Saving Now..." + Cancel, auto-dismiss on success; pipeToolingCopiedModal — "Copied to clipboard" toast (1.5s auto-dismiss); noteModal — Add/Edit Note (textarea, Cancel/Done); Choose Line Type modal — tabs Choose Line Type / Create Line Type; macrosModal — Keyboard Shortcuts (M/S/C/L/P/D/H/N/Esc/arrows/Enter/Ctrl+Z/Ctrl+Shift+Z), opened via status bar "Macros" link; counterLineTypeDetailsModal — opened via edit pen on Counter or Line Type row; Name (editable), Color (swatch), On pages (clickable jump), Delete (count=0 immediate; count>0 confirm + remove markers/lines); summaryCountDetailModal — "— by page" breakdown with thumbnails when clicking count/line in sidebar Summary
- **Export Options** — Yellow section title above Specific Pages in sidebar (`#exportOptionsSectionTitle`); Copy Summary (Email/Text) button copies counts and lines as plain text for email/paste
- **Copy to PipeTooling** — Button below Specific Pages; copies tab-delimited summary (fixture, count, page) to clipboard via `getPipeToolingSummary()`; counters as name/count/pages; line types as `[unit] of [name]`/length/pages; hidden when no counts or lines
- **Show Highlights / Show Notes** — Buttons open highlights or notes summary in new tab (not download); hidden when no highlights or no notes respectively; checkbox in Combined PDF and Specific Pages modals for bundling to PDF
- **Hotkeys** — M (Move), S (Set Scale), C (Counter), L (Quick Line), P (Polyline), D (Measure Distance), H (Highlight), N (Note); Ctrl+Z / Ctrl+Shift+Z for Undo/Redo; ignored when focus is in input/textarea/contenteditable
- **Counter settings** — Ring section only visible when "Show ring around counters" checked; Solid ring default is true
- **Mobile header slot** — When no PDF: Upload PDF in header; when PDF loaded: Set Scale (until scale set); `body.has-pdf` toggled in updateUI
- **Status bar** — Dual indicators: circle (dot) = canvas sync, square = PDF sync; each has a label next to it (e.g. "Canvas Synced with Cloud", "PDF Synced with Cloud", "PDF No PDF in project"); both use red/yellow/green/grey; messages: "Project not saved to cloud", "Upload PDF to start a project" (no PDF); Save Project to Cloud / Load Project from Cloud; save progress shown during upload
- **Pages badges** — `badge-scale-set` = yellow number when scale set; `badge-has-ann` = yellow outline when page has counts, lines, notes, or highlights
- **Page rotation** — Per-page `page.rotation` (0/90/180/270); rotate button (↻) in zoom bar; `rotatePage90()` transforms annotations; notes text rotates with page; persisted in save/load
- **Counter/Line Type row** — Row click selects for placing; edit pen (✎) opens counterLineTypeDetailsModal (Name, Color, On pages, Delete)
- **Marked page navigation** — ‹‹ and ›› buttons outside page nav; jump to previous/next page with annotations; yellow text and border when selectable
- **Auto-save** — Every 5 seconds when dirty: signed-in to Supabase, unsigned to localStorage; 5-second localStorage backup for all users; `markProjectDirty()`, `performAutoSave()`, `autoSaveDirty`, `lastSaveIncludedPdf`, `savePdfInProgress`; PDF IndexedDB cache on save; last-project restore from `clickcount-last-project`; save-before-load prompt when loading with unsaved changes; `withTimeout` wraps Supabase calls in performAutoSave and doTurnIn to prevent hang
- **Undo/Redo** — Last 5 moves in local memory; `undoStack`, `redoStack`, `pushUndoSnapshot()`, `clearUndoStacks()`; Undo/Redo buttons in bottom bar next to rotate; Ctrl+Z / Ctrl+Shift+Z; cleared on load, project switch, or when viewer
- **Middle mouse pan** — Hold middle mouse button to pan regardless of active tool; `state.isPanning`, `state.panStart`; move SVG cursor during pan; window mouseup releases when released outside canvas
- **Sharing** — `project_shares` table; checkout/turn-in (one editor at a time); 30-minute inactivity expiry (lock extends on edits/saves via `refresh_checkout_activity`); system admin can force turn-in; `state.isViewer`, `state.canCheckOut`, `state.checkedOutBy`, `state.checkedOutEmail`; Load Project uses `list_accessible_projects` RPC; Share modal adds users via `invite-to-project` Edge Function; when admin force turns in, user with project open gets realtime notification ("Project was turned in. You can check out to edit again.") and UI switches to view mode via `refreshProjectPermissions`; Manage Projects modal has Force turn-in (admin) per checked-out row; `list_projects_for_admin` returns `checked_out_by`, `checked_out_at`, `checked_out_email` (migration 025)
- **View links** — `project_view_links`, `view_link_access_log`; Share modal "View links" section: create, list, copy URL, access log, revoke; URL `?t=TOKEN`; `get-view-project` Edge Function (no JWT); email domain gate (clickplumbing.com); `viewCacheGet`/`viewCachePut` for IndexedDB; `viewLinkEmailModal`; `initViewOnlyMode(viewToken)` on boot when `?t=` present; Copy view link button (`#copyViewLinkBtn`) left of gear copies most recent view link (creates if none); create restricted to owners/editors — copyViewLinkBtn and shareViewLinkCreate hidden when `state.isViewer`

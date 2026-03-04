# ClickCount — Agent Instructions

## Spec Reference

**RECONSTITUTE.md** (if present) is the base spec for behavior and data structures; otherwise see ARCHITECTURE.md. The app includes many extensions; see ARCHITECTURE.md "Features Beyond Spec" for the full list.

## Tech Constraints

- Vanilla HTML, CSS, JavaScript
- No build step; static deployment
- Single-file architecture: HTML + CSS + JS in `index.html`
- report.js loads after index.html and uses globals: `state`, `makeAnnotations`, `ptDist`, `polylineDistance`, `formatDist`, `renderIconHtml`; exposes `buildReportHtml`, `printReport`, `getPipeToolingSummary`
- jsPDF for Export PDF; html2canvas for report-to-PDF (Combined PDF, Specific Pages)
- Supabase (optional): Auth, projects table (`pdf_path`, `pdf_hash`, `size_bytes`), `pdfs` storage bucket, RPC `list_users_for_admin`, `list_projects_for_admin`; Edge Functions (`admin-create-user`, `admin-delete-user`, `admin-delete-project`, `admin-list-users`); config via `config.js` (see SUPABASE_SETUP.md)

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
- **Modals**: Project Settings (gear) — Save Project to Cloud, Load Project from Cloud, Close Project (hidden when no project), Add additional PDF pages (when PDF uploaded), Advanced section (collapsed by default) with Manage Icons, Export Canvas, Import Canvas; User Settings (user icon) — email, password, Airboard (Save/Load/Export counters and line types to user profile), Add User / Manage User (admin), All Users (admin), Sign Out; Manage User modal — list users with Delete per row; Manage Projects modal — list all projects with Delete per row; project name on top, date/time/size below, "Canvas only" badge for projects without PDF; Specific Pages modal — thumbnails, per-page marked/unmarked/exclude, bulk actions, Include takeoff report / Bundle highlights / Bundle notes checkboxes with "— none to show" and disabled when no data; loadAnnotationsModal — "You have saved annotations for this PDF. Load them?" with project list; shown on PDF upload when hash matches cloud projects; saveBeforeLoadModal — unsaved changes prompt (Save now / Don't Save / Cancel); when saving shows "Saving Now..." + Cancel, auto-dismiss on success; pipeToolingCopiedModal — "Copied to clipboard" toast (1.5s auto-dismiss); noteModal — Add/Edit Note (textarea, Cancel/Done); Choose Line Type modal — tabs Choose Line Type / Create Line Type; macrosModal — Keyboard Shortcuts (M/S/C/L/P/D/H/N/Esc/arrows/Enter), opened via status bar "Macros" link
- **Export Options** — Yellow section title above Specific Pages in sidebar (`#exportOptionsSectionTitle`)
- **Copy to PipeTooling** — Button below Specific Pages; copies tab-delimited summary (fixture, count, page) to clipboard via `getPipeToolingSummary()`; counters as name/count/pages; line types as `[unit] of [name]`/length/pages; hidden when no counts or lines
- **Show Highlights / Show Notes** — Buttons open highlights or notes summary in new tab (not download); hidden when no highlights or no notes respectively; checkbox in Combined PDF and Specific Pages modals for bundling to PDF
- **Hotkeys** — M (Move), S (Set Scale), C (Counter), L (Quick Line), P (Polyline), D (Measure Distance), H (Highlight), N (Note); ignored when focus is in input/textarea/contenteditable
- **Counter settings** — Ring section only visible when "Show ring around counters" checked; Solid ring default is true
- **Status bar** — Dual indicators: circle (dot) = canvas sync, square = PDF sync; both use red/yellow/green/grey; messages: "Project not saved to cloud", "Upload PDF to start a project" (no PDF), "Synced with Cloud (canvas only)", "Synced with Cloud (canvas + PDF)"; Save Project to Cloud / Load Project from Cloud; save progress shown during upload
- **Pages badges** — `badge-scale-set` = yellow number when scale set; `badge-has-ann` = yellow outline when page has counts, lines, notes, or highlights
- **Marked page navigation** — ‹‹ and ›› buttons outside page nav; jump to previous/next page with annotations; yellow text and border when selectable
- **Auto-save** — Every 1 min: signed-in to Supabase, unsigned to localStorage; 5-second localStorage backup for all users; `markProjectDirty()`, `performAutoSave()`, `autoSaveDirty`, `lastSaveIncludedPdf`, `savePdfInProgress`; PDF IndexedDB cache on save; last-project restore from `clickcount-last-project`; save-before-load prompt when loading with unsaved changes

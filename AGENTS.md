# ClickCount — Agent Instructions

## Spec Reference

**RECONSTITUTE.md** is the base spec for behavior and data structures. The app includes many extensions; see ARCHITECTURE.md "Features Beyond Spec" for the full list.

## Tech Constraints

- Vanilla HTML, CSS, JavaScript
- No build step; static deployment
- Single-file architecture: HTML + CSS + JS in `index.html`
- report.js loads after index.html and uses globals: `state`, `makeAnnotations`, `ptDist`, `polylineDistance`, `formatDist`, `renderIconHtml`
- jsPDF for Export PDF
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
- **Persisted settings** (localStorage): `counterSettings`, `lineTypeSettings`, `exportSettings`, `recentLineColors`, `pageScales`; include new fields in export/import when adding
- **Line color modal**: `showLineColorModal(currentColor, onApply)` — used for Counters, Line Types, and Lines
- **Supabase**: When enabled, `state.supabaseSession`, `state.isAdmin`, `state.currentProjectId`, `state.currentProjectName`; cloud features hidden when `SUPABASE_ENABLED` is false; PDF uploads limited to 50 MB (Supabase storage limit)
- **Modals**: Project Settings (gear) — Save/Load/Close Project, Manage Projects (admin), Export, Import; User Settings (user icon) — email, password, Add User / Manage User (admin), All Users (admin), Sign Out; Manage User modal — list users with Delete per row; Manage Projects modal — list all projects with Delete per row

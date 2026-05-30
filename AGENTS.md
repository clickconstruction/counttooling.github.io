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
  ~2.1k lines; no inline JS logic — the body loads `app.js` then `report.js`),
  [app.js](app.js) (the entire app logic — the former inline `index.html` IIFE,
  extracted verbatim into a classic `<script src>`, ~16.2k lines; resolves the
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
  [save-utils.js](save-utils.js) (pure save/sync helpers: `isTransientSaveError`,
  `getProjectCounts`; classic script loaded before app.js; guarded CommonJS
  footer so [save-utils.test.js](save-utils.test.js) can `require()` it), and
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
  runs the dependency-free Node unit tests ([geometry.test.js](geometry.test.js),
  [constants.test.js](constants.test.js), [report.test.js](report.test.js),
  [save-utils.test.js](save-utils.test.js)) via
  `node --test`. Naming split (enforced by `testMatch` in
  [playwright.config.js](playwright.config.js)): `*.spec.js` = Playwright,
  `*.test.js` = Node unit tests.
- **Aggregate check**: `npm run check` runs lint + `test:unit` + `build:toc --check`
  (fast, no browser/cloud). [.github/workflows/ci.yml](.github/workflows/ci.yml)
  runs it on every push/PR (Node 20); Playwright is excluded from CI because it
  needs a server + Supabase/dev-auth secrets.
- **Linting**: `npm run lint` (ESLint v9 flat config, [eslint.config.js](eslint.config.js))
  covers all the `.js` — the browser modules (`geometry.js`, `constants.js`,
  `icons.js`, `save-utils.js`, `report.js`), the whole app (`app.js`), and the
  Node tooling (tests, specs + helpers, `scripts/`, configs). Now that the JS
  lives in `app.js` (not an inline `<script>`), the entire app is linted. The
  `app.js` group auto-derives the sibling modules' exports as `readonly` globals
  (via `require()`) and runs the recommended set as **warnings** with `no-undef`
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
2. **Do not trust line numbers** — [app.js](app.js) is ~16k lines. Navigate
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

### Persisted settings (localStorage unless noted)

`counterSettings`, `lineTypeSettings` (includes `parallelEndsSize`,
`lengthLabelSize`, `snapToHorizontalVertical`, `showOnlyLinesOnCurrentPage`),
`legendSettings`, `multiplyZoneSettings`, `gridSettings`, `showGridOverlay`,
`exportSettings` (includes `bundleHighlightsToPdf`, `bundleNotesToPdf`),
`recentLineColors`, `iconNames`, `iconOrder`, `pageScales`, `zoomSettings`,
`groupColorDisplay`, `pagesTitlesTruncated`, `hideUnmarkedPagesFromSidebar`,
`counterSearch`, `lineTypeSearch`, `linesSearch`, `linesTypeExpanded`,
`loadProjectFiltersExpanded`, `plumbingModifiers` (includes `iconByType`),
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
  (`buildSaveLogsEnvelope`, schema `clickcount-save-logs/v1`).
- Sharing uses checkout/turn-in (one editor at a time, 30-minute inactivity expiry
  with keep-alive). Admins can force turn-in. Expiry surfaces a recovery modal with
  silent auto-recheckout under it. Symbols: `doTurnIn`,
  `subscribeToProjectCheckoutChanges`, `refreshProjectPermissions`,
  `handleBackgroundCheckoutExpired`, `openCheckoutExpiredRecoveryModal`.

### Hotkeys

M (Move), S (Set Scale), C (Counter), L (Line modal), J (Snap to H/V), P
(Polyline), D (Measure), H (Highlight), X (Multiply Zone), N (Note), R (Rotate
page); Shift+C / Shift+L open Quick tabs; arrows: Left/Right page nav
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

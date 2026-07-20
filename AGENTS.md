# ClickCount — Agent Instructions

## Doc map

- [RECONSTITUTE.md](RECONSTITUTE.md) — base spec: core data model, coordinate
  contract, invariants. Read this first to understand what the app *is*.
- [ARCHITECTURE.md](ARCHITECTURE.md) — code map (how to navigate `app.js` +
  `app/index.html`), the per-file "Files" table (the **single source of truth**
  for what each file owns), and the full feature catalog ("Features Beyond
  Spec").
- [CHANGELOG.md](CHANGELOG.md) — implementation history (the sync-hardening PRs and
  other detail). Consult when you need the "why" behind the save/sync machinery.
- [SUPABASE_SETUP.md](SUPABASE_SETUP.md) — cloud setup, migrations, Edge Functions.
- [CUSTOM_ICONS.md](CUSTOM_ICONS.md) — bundled vs user-uploaded icons.

## Tech constraints

- Vanilla HTML, CSS, JavaScript. No build step; static deployment.
- **Site layout**: the app shell is `app/index.html`, served at **`/app/`** (its `<script>`/
  `<link>` refs are **root-absolute** `/...` so the shared assets stay at repo root). The
  site **root `/` is a static marketing landing** (`index.html`) — plain HTML, no app JS,
  outside the service-worker scope; it forwards old `/?t=`/`?devAuth=1` links to `/app/`.
  Playwright app specs `goto('/app/')`; `seo.spec.js` tests the landing at `/`.
- **Marketing site & /guides/ (Help)**: the landing (`index.html`) and the evergreen Help
  section at `/guides/` are plain static HTML sharing `marketing.css` (mirror of the
  styles.css `:root` tokens; **not** the app's styles.css). Guide articles are authored as
  **Markdown** in `content/guides/<slug>.md` (front-matter: title/description/updated/order);
  `npm run build:guides` renders `guides/<slug>/index.html` + `guides/index.html` and
  regenerates `sitemap.xml` (uses the `marked` devDep; loaded via dynamic `import()` since
  it's ESM-only). It's a committed-artifact generator like `build:toc` — `npm run check`
  includes `build:guides -- --check` (fails if the committed HTML is stale). Authoring steps:
  `content/guides/README.md`. Tests: `guides.test.js` (Node, CI — SEO/link/sitemap integrity)
  + `guides.spec.js` (Playwright, local). **Guide visuals** are generated, not hand-captured:
  `npm run build:sample-plan` makes a synthetic floor plan (`samples/sample-plan.pdf`), and
  `npm run build:screenshots` (`scripts/build-screenshots.js`) drives the real app headlessly,
  lays a sample takeoff on it, opens dialogs, overlays numbered callouts, and writes
  `guides/img/*.png` referenced from articles via Markdown `![]()`. Both are manual (browser +
  non-deterministic pixels) and **not** in `npm run check` — like `build:og-image`; the
  link-integrity test fails only if an article references a missing image.
- **PWA / offline**: the app is an installable PWA (scoped to `/app/`). Third-party libs (pdf.js + worker,
  pdf-lib, html2canvas, jsPDF, supabase-js, tus) and fonts are **vendored locally** in
  `vendor/` / `vendor/fonts/` (version-pinned filenames — not CDN), so the app is
  same-origin except Supabase. [sw.js](sw.js) precaches the whole shell for offline use;
  [manifest.webmanifest](manifest.webmanifest) + head meta make it installable.
  **`CACHE_VERSION` in [sw.js](sw.js) is GENERATED — never edit it by hand.** It is a
  content hash of every precached asset, stamped by `npm run build:sw`
  ([scripts/build-sw.js](scripts/build-sw.js)); run it after changing any precached file
  (`npm run check` includes `build:sw -- --check` and fails when stale; the admin
  global-force-reload is the backstop). When you add/rename a shell file (a
  `features/*.js`, a `vendor/*` lib, a font), update the app/index.html tag **and**
  `PRECACHE_URLS` in sw.js (still hand-maintained), then run `npm run build:sw`.
  Regen icons with `npm run build:pwa-icons`.
  After a deploy, a returning tab renders one "mixed shell" (network-first HTML + the
  previous version's cached assets) until the updated SW takes control; the app.js boot
  reloads once on that `controllerchange` (only when it's an update, no project is open,
  and nothing is dirty) so users aren't left on mismatched UI. See ARCHITECTURE.md
  "PWA / offline".
- Static assets, no bundler: the app is split across classic `<link>` /
  `<script src>` files sharing state through `window` globals and the shared
  global lexical scope. **Per-file detail (what each file owns, its `App.*`
  deps, how it was extracted) lives in ONE place: the
  [ARCHITECTURE.md](ARCHITECTURE.md) "Files" table** — keep it there, don't
  re-duplicate it here. Load-order summary:
  - [app/index.html](app/index.html) — the app shell: HTML structure + every
    modal (~2.3k lines; no inline JS logic). Its `<script>`/`<link>` refs are
    root-absolute. Loads, in order:
  - **Pure modules**, before app.js — no `state`/DOM dependency; each ends in
    a guarded CommonJS footer (inert in the browser) so its sibling
    `*.test.js` can `require()` it under `node --test`. Where a helper needs
    `state`-derived values, the pure function takes them as arguments and
    app.js keeps a same-named thin wrapper that resolves and delegates (so
    call sites and the report.js `window.*` contract never changed):
    [icons.js](icons.js) (bundled icon data: `*_PATH` consts,
    `VB_384_512_PATHS`, `FA_PATHS`, `RING_PATH`, `ICONS`),
    [icons-custom.js](icons-custom.js) (the GENERATED `CUSTOM_ICONS` array —
    `npm run build:icons` overwrites it wholesale; loads right after icons.js),
    [geometry.js](geometry.js) (pure math/geometry/parse primitives),
    [constants.js](constants.js) (pure constant literals — `TOOL`,
    `SCALE_MODES`, `COLORS`, `SCALE_PRESETS`, timing/threshold blocks, IDB
    store names — plus `nextRecentColors`; env reads and icon-derived consts
    stay in app.js), [idb.js](idb.js) (IndexedDB storage layer; loads after
    constants.js), [format.js](format.js) (User Activity date/text
    formatters; after constants.js), [icon-render.js](icon-render.js) (icon
    geometry/render-rule helpers; after icons.js),
    [line-metrics.js](line-metrics.js) (line length/scale math; after
    geometry.js), [canvas-draw.js](canvas-draw.js) (the unified annotation
    draw core — `createCanvasDraw(deps)` + `drawAnnotationsCore(ctx, ann, env)`;
    both `renderAnnotations` and `renderAnnotationsToContext` are thin
    env-builders over it, so a new mark kind is drawn once; after geometry.js +
    icons.js; guarded by the [render-pixels.spec.js](render-pixels.spec.js)
    pixel baselines), [render-service.js](render-service.js) (the raster
    seam — every pdf.js raster flows through `createRenderService(deps)`;
    main-thread or the [render-worker.js](render-worker.js) render worker,
    chosen automatically with lazy doc adoption + session fallback; the
    worker file is NOT a script tag — it's `new Worker('/render-worker.js')`,
    but IS precached), [save-utils.js](save-utils.js) (pure save/sync helpers),
    [save-engine.js](save-engine.js) (the save/sync engine module —
    `createSaveEngine(ctx)`; app.js instantiates it with live-value
    accessors and keeps same-named wrappers; staged extraction, Stage 1:
    global force reload + checkout keep-alive).
  - [app.js](app.js) — the main IIFE (~7.1k lines), the bulk of the app
    logic. Resolves the sibling modules' values by bare name, publishes the
    shared surface onto the `window.App` registry near its tail
    (`// SECTION: App feature registry`), and exposes its own helpers to
    report.js via `window.*`. Linted with `no-undef` as error, the rest of
    the recommended set as warnings.
  - **41 `features/*.js` registry files**, after app.js and before
    report.js — one IIFE per feature/modal that reads its deps from `App.*`
    at call time and registers its public entry points back onto `App` (rules
    in "`window.App` registry" below; per-file entry points + deps in the
    ARCHITECTURE.md Files table; extraction history in
    [CHANGELOG.md](CHANGELOG.md) "Modularization"). Each has a matching
    `*.spec.js` Playwright regression.
  - [report.js](report.js) — the report/summary builder (contract next
    bullet).
  - [styles.css](styles.css) — all CSS (design tokens, layout, modals,
    sidebar, mobile), linked from `<head>`.
- [report.js](report.js) loads after app.js and consumes these globals (keep
  them on `window`): `state`, `makeAnnotations`, `ptDist`, `polylineDistance`,
  `formatDist`, `renderIconHtml`, `quickLineLength`, `getLineLengthPdfPts`,
  `getLineLengthForTotals`, `getLineLengthFeetForTotals` (per-line-type tally length
  converted to feet, for the always-feet summaries/exports), `getLineRealWorldLength`,
  `getMultiplyZoneForLine`,
  `getMultiplyZoneForPoint`, `getEffectiveScaleForLine`, `getMergedAnnotationsForPage`.
  It exposes `buildReportHtml`, `printReport`, `getPipeToolingSummary`,
  `getPipeToolingHasData` (cheap counts-or-lines existence check used by
  `updateUI`), `getEmailTextSummary`; both summary functions accept optional
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
  [line-metrics.test.js](line-metrics.test.js),
  [canvas-draw.test.js](canvas-draw.test.js),
  [render-service.test.js](render-service.test.js),
  [save-engine.test.js](save-engine.test.js)) via
  `node --test`. All are dependency-free except [idb.test.js](idb.test.js),
  which uses the `fake-indexeddb` devDependency. [format.test.js](format.test.js)
  auto-skips its two en-CA-hyphen-dependent cases on a limited-ICU runtime and
  runs them on full-ICU (browser-equivalent / CI Node 20). Naming split (enforced by `testMatch` in
  [playwright.config.js](playwright.config.js)): `*.spec.js` = Playwright,
  `*.test.js` = Node unit tests.
- **Aggregate check**: `npm run check` runs lint + `test:unit` + `build:toc --check`
  + `build:guides --check` + `build:sw --check`
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
  `admin-delete-user` (optional `reassignToUserId`), `admin-reassign-projects`,
  `admin-set-password`, `admin-delete-project`, `admin-list-users`,
  `invite-to-project`, `get-view-project`, `set-view-scale` (viewer sets a
  page scale for everyone; token + email-domain gated); `admin-reassign-projects` +
  `admin-delete-user` share the `_shared/reassignProjects.ts` ownership-move
  engine). Config via `config.js` (see
  [SUPABASE_SETUP.md](SUPABASE_SETUP.md)). PDF uploads capped at 50 MB.
- **Supabase migrations**: when creating or modifying files in
  `supabase/migrations/`, apply them via the Supabase MCP `apply_migration` tool
  (name = filename without `.sql`, query = file contents).

## Navigation

1. Read [RECONSTITUTE.md](RECONSTITUTE.md) for the core model, then
   [ARCHITECTURE.md](ARCHITECTURE.md) for the code map and feature catalog.
2. **Do not trust line numbers** — [app.js](app.js) is ~7.1k lines. Navigate
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

`app.js` is one ~7.1k-line IIFE, so feature code that moves to a separate
`<script>` cannot see its closure-locals by bare name. The `window.App` registry
is the bridge for incremental splits (full contract + extraction recipe in
[ARCHITECTURE.md](ARCHITECTURE.md) "Feature files / `window.App` registry").
Rules to follow when adding/editing a feature file:

- `app.js` publishes the shared surface near its tail
  (`// SECTION: App feature registry`): `const App = (window.App = window.App || {});`
  then `App.state = state; App.renderPdf = renderPdf; …`. **The live list is the
  code — read the registry section in app.js** (and each feature file's header)
  rather than an enumeration here; per-feature deps are itemized in the
  [ARCHITECTURE.md](ARCHITECTURE.md) Files table. Most entries are
  "publish-only" — the function stays defined in app.js (used widely there) and
  is merely exposed on `App` (e.g. `showToast`, `updateUI`, `getPageScale`,
  `renderAnnotations`, the `TOOL`/`COLORS`/`SCALE_*` constants, geometry
  globals like `ptDist`/`parseFraction`); only the feature's *own* functions
  move out. When a feature needs a new app.js dep, publish it in the registry
  block. Leave the existing `window.*` report.js exports alone.
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
`recentRoomHeights` (Room Sizer recent ceiling heights, decimal feet, max 5),
`recentLineColors` (shared recent-color list, written by `pushRecentColor` —
custom/off-palette colors only, presets skipped; consumed by the edit color
picker and the Create Counter / Create Line Type pickers), `iconNames`,
`iconOrder`, `pageScales`, `zoomSettings`,
`groupColorDisplay`, `pagesTitlesTruncated`, `hideUnmarkedPagesFromSidebar`,
`counterSearch`, `lineTypeSearch`, `linesSearch`, `linesTypeExpanded`,
`loadProjectFiltersExpanded`, `loadProjectAdvanced` (admin-only; shows the Load
Project rows' "Who has access" block), `plumbingModifiers` (includes `iconByType`),
`lineModifiers`, `specificPagesIncludeReport`, `clickcount-last-project`,
`clickcount-last-global-reload`, `clickcount-debug-save` (Save Status Verbose
mode).

- `customIconPaths` lives in **IndexedDB** (in-memory cache, per-user key; one-time
  migration from localStorage / legacy key).
- Per view token (localStorage): `view:allowed:<token>` (accepted viewer email),
  `view:hideMarks:<token>`, `view:scale:<token>` (the viewer's temporary local
  page scales — the offline fallback when the shared `set-view-scale` write
  fails; a page-index → scale map, server scale wins on restore).
- Per-project, in save/load: `maxZoom`, `groups`, `rooms` (Room Sizer palette —
  each canvas's `annotations.roomBoxes` references a room id), `activeCanvasIdByPage`. Each saved
  page also carries `bakeFrame` `{ w, h, intrinsic }` (the viewport dims at `page.rotation`
  + the PDF's intrinsic `/Rotate`) so a later load / view-link viewer can detect when the
  loaded PDF would render the page in a different orientation than the marks were baked
  against (`computePageBakeFrame` stamps it, `verifyPageBakeFrame` checks it on load via the
  pure `bakeFramesMatch`; on mismatch it warns + toasts + sets `page.bakeMismatch`, never
  auto-corrects). The IndexedDB takeoff backup carries the parallel `pageBakeFrames` array.
- In-memory only (not persisted): `state.pdfBufferSize` (bytes; set whenever
  `state.pdfBuffer` is set, because pdf.js detaches the buffer making `byteLength`
  0), `state.userActivityAllRowsCache`, `state.userActivityViewMode`,
  `state.showAllCanvases` (the desktop show-all-layers peek toggle).
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
  `dataJsonBytes`/`pdfBufferBytes`/`nearPdfCap`, plus per-page rotation diagnostics
  `pageRotation`/`pageBake`/`bakeMismatchPages`), `display` (`devicePixelRatio`,
  probed `canvasCaps`, `renderAreaSafety`, last-render buffer dims -- for "counts vanish
  at high zoom"; a `canvas_render_blank` event also rides the log when the read-back guard
  ratchets), `storage`
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
(Polyline), D (Measure), H (Highlight), X (Multiply Zone), V (Room Sizer), N
(Note), R (Rotate page); Shift+Q open Quick tab (Counter or Choose Line Type modal); arrows: Left/Right page nav
(Shift = marked-page jump), Up/Down canvas layers; Ctrl+Z / Ctrl+Shift+Z
undo/redo; Ctrl+R refresh. Ignored when focus is in an input/textarea/contenteditable.

### Shared UI patterns

- **Line color modal**: `showLineColorModal(currentColor, onApply)` — used for
  editing Counters, Line Types, Groups, Lines (Presets / picker / Recent).
- **Inline create color picker**: `setupCreateColorPicker({ presetsRowId,
  customInputId, recentRowId, recentGroupId, defaultColor })` — the Presets /
  custom `<input type="color">` / Recent picker embedded in the three create
  surfaces: Create Counter (`#counterColorRow`), the Add Line Type modal opened by
  the sidebar "+ Add" (`#lineTypeColorRow`, app.js), and the Quick-Line Create-tab
  panel (`#createLineTypeColorRow`, features/choose-create-line-type.js).
  Selection is value-based: the chosen color lives on
  the presets row's `dataset.selectedColor`. Recents commit only on Create, via
  `pushRecentColor(color)` (shared list `state.recentLineColors`, custom-only,
  localStorage-persisted; `nextRecentColors` is the pure core in constants.js).
- **Toggle switches**: `.toggle-switch` + `.toggle-switch-knob` — used for Show
  group colors, Counter Settings (Show ring, Solid ring), Save Project Include PDF,
  Export PDFs (Bundle highlights/notes, Include report).
- For the full modal/feature inventory and exact symbols, see
  [ARCHITECTURE.md](ARCHITECTURE.md) "Features Beyond Spec".

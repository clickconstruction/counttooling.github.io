# ClickCount — Agent Instructions

## Doc map

- [RECONSTITUTE.md](RECONSTITUTE.md) — base spec: core data model, coordinate
  contract, invariants. Read this first to understand what the app *is*.
- [ARCHITECTURE.md](ARCHITECTURE.md) — code map (how to navigate `app.js` +
  `app/index.html`), the per-file "Files" table (the **single source of truth**
  for what each file owns), and the full feature catalog ("Features Beyond
  Spec").
- [DECOMPOSITION_MAP.md](DECOMPOSITION_MAP.md) — **where to decompose next**: the
  ranked refactor shortlist, per-area verdicts, and the defects found while mapping.
  It is a dated reading of `npm run build:projectmap`, which regenerates the measured
  skeleton under it (`project-map/`, gitignored: registry graph, state writes, modal
  ownership, big functions, near-duplicate blocks, churn since the last map) in a
  few seconds. Run it before planning a split; don't hand-count.
- [CHANGELOG.md](CHANGELOG.md) — implementation history (the sync-hardening PRs and
  other detail). Consult when you need the "why" behind the save/sync machinery.
- [PUNCHLIST.md](PUNCHLIST.md) — **every open item, one line each**. An index, not
  a container: the detail stays in the plan file or dossier that owns it. Read it
  to answer "what is still open?"; write to it per "Recording a to-do" below.
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
  `npm run build:sample-plan` makes a synthetic floor plan (`samples/sample-plan.pdf`; `build:sample-plan-advanced` the restaurant plumbing sheet `samples/sample-plan-advanced.pdf`), and
  `npm run build:screenshots` (`scripts/build-screenshots.js`) drives the real app headlessly,
  lays a sample takeoff on it, opens dialogs, overlays numbered callouts, and writes
  `guides/img/*.png` referenced from articles via Markdown `![]()`; `--set spotlight` builds the
  landing's trade-spotlight frames instead (`img/spotlight/<trade>-<n>-<slug>.jpg`, a per-frame
  4:3 `crop` sized to its surface, JPEG; plan in journeys/plans/LANDING-REFRESH.md). Both are manual (browser +
  non-deterministic pixels) and **not** in `npm run check` — like `build:og-image`; the
  link-integrity test fails only if an article references a missing image.
  **The lesson set** `samples/sample-lessons.pdf` (`npm run build:sample-lessons`) is the four sheets Learn's lessons and the plumbing course run on, and **the electrical set** `samples/sample-electrical.pdf` (`npm run build:sample-electrical`, scripts/sample-electrical.js on P-101's `restaurantShell`) the four the electrical course runs on, and **the HVAC set** `samples/sample-hvac.pdf` (`npm run build:sample-hvac`, scripts/sample-hvac.js) the three the HVAC course runs on; its P-401 / P-501 coordinates are the ones in features/lessons.js, so change a sheet and its lesson in the same commit (lessons.spec.js walks every lesson).
  **The landing hero is three films, one per trade**: `npm run build:hero-video -- --film
  plumbing|electrical|hvac` ([scripts/build-hero-video.js](scripts/build-hero-video.js)) drives
  the real app frame by frame on a sample sheet (real mouse, typing and key presses, drawn
  cursor and keycaps, caption strip; every dialog is the app's own, nothing seeded that the
  estimator would do) and encodes `img/hero-<film>.{mp4,png}` with ffmpeg (the PNG is the
  poster; plumbing's is the SEO spec's `img.hero-shot`). Manual, like `build:screenshots`.
  `index.html`'s trade chips are the selector: the pressed chip is the film selected, the lit
  one is playing, a click swaps the film in place. A film plays ONCE and holds on its finished
  takeoff (the still under the video is its last frame). **The hero chapters** are a two-line bar
  under the film: a question the film's own clock answers, and four chapters (Scale, what the
  trade counts, what it runs, Pricing) as a rail that fills in turn and seeks on click, each
  naming its seconds, over a three-row **caption scroller** (the beat on screen beside a caret, the
  one before and the one coming dimmed around it). The films carry NO baked caption: the wording
  lives in the chapters file's `beats`, in plain sentences of at most 100 characters, and a film
  marks its chapters with `R.chapter(name)`. It all reads `img/hero-<film>.chapters.json`, which the generator writes
  (`--chapters-only` re-times a film in about a minute without rendering it; `CHAPTER_STARTS`
  names the chapters). Change a film's captions or beats and re-run it, or the bar drifts from
  the footage (landing-trade.spec.js compares each file to its mp4's length). The same pass writes
  the end screen's two results from the film's final state, `img/hero-<film>-sheet.jpg` (the
  marked-up sheet) and `img/hero-<film>-report.jpg` (Show Report for it), which the landing
  offers in the lightbox when the film holds. Each film's script ends with a guard that throws
  if the app's own Bid Check warns.
  Gotchas for the generator (the toast timers, the stroke key, the real dialog selectors) are
  in [journeys/plans/LANDING-REFRESH.md](journeys/plans/LANDING-REFRESH.md).
- **The Modal Gallery (developer view)**: `/app/?gallery=1` lays every modal in the shell out on
  one page in the app's own markup and CSS (features/modal-gallery.js, injected by the boot only on
  that param, never a shell script tag, never precached), with Populate (the real openers), Open
  live (the fixed backdrop), Load sample, Reload CSS (cache-busted past the service worker) and a
  375px Mobile embed. Use it to judge a styles.css change across all ~75 dialogs at once.
  `npm run build:modal-gallery` (scripts/build-modal-gallery.js) shoots the contact sheet, one PNG
  per tile at both widths, into `contact-sheet/`; `--baseline <dir>` makes a
  before/after. Manual, like `build:screenshots`. Detail: ARCHITECTURE.md Files table.
- **The rulebook (/rules/)**: the PUBLIC trade rules the app applies (NEC fill limits,
  the voltage-drop recommendation, SMACNA-style gauge, mount heights, hanger spacing…),
  written as the app applies them and cited by section — never the code text reprinted,
  never company practice (that lives with pricing in PipeTooling). One Markdown file per
  rule in `content/rules/<trade>/<slug>.md` with STRUCTURED front-matter (`id`, `kind`
  code|standard|recommendation|convention, `status` applied|draft, `values[]` with
  `when`/`value`/`unit`, `source` code+section+editions, `amendments`, `used_by`) and a
  prose body — authoring rules in `content/rules/README.md`. `npm run build:rules`
  ([scripts/build-rules.js](scripts/build-rules.js), on [scripts/lib/rules.js](scripts/lib/rules.js)
  + the shared site chrome in [scripts/lib/site.js](scripts/lib/site.js)) renders
  `rules/<trade>/<slug>/index.html`, the searchable `rules/index.html`, and
  `rules/rules.json` (the same list for the app and any AI — stable ids). **The drift
  check**: a value row's `code: <file>.js#<expr>` pointer is resolved against the
  module's CommonJS exports (walked, never eval'd) and must equal the rule
  (× `scale`); `build:rules --check` — in `npm run check` — fails on a mismatch, so a
  number in code cannot change without its rule. When you change one of those
  tables (`fillLimitFor`, `VD_K`, `VD_LIMIT_PCT_DEFAULT`, `ELECTRICAL_DEFAULTS.mountByType`,
  `DEFAULT_MAKE_UP_FT`, `DUCT_GAUGE_TABLE`, `SHEET_WEIGHT_LB_PER_SQFT`,
  `DUCT_SETTINGS_DEFAULTS`, `ROOM_TYPE_CFM_PER_SQFT`, and water-model.js's `WSFU_LOADS`,
  `DEMAND_CURVE`, `WATER_VELOCITY_CAP_FPS`, `PIPE_ID_IN`, `FIXTURE_SUPPLY_MIN_IN`,
  `WATER_SERVICE_MIN_IN`), change the rule in the same
  commit. And a tour, lesson or course step that teaches a rule names it: `rules:
  ['plumb.hanger.pex']` on the step object (ids from `rules/rules.json`), or
  `rulesExempt: 'no rulebook entry: <section, subject>'` when it cites a section the
  rulebook does not hold yet. [scripts/check-lesson-rules.js](scripts/check-lesson-rules.js)
  (in `npm run check`, espree over features/tutorial.js, tour-blank.js, lessons.js and
  the three course files) fails an unknown id, a citation or a rule's number beside its
  subject with neither key, and a named rule's number the rule does not hold, so a card,
  its rule and the code cannot disagree unnoticed; `--gaps` lists the exemptions (the
  sections the rulebook still lacks), `--trace` every number it judged.
  [check-lesson-rules.test.js](check-lesson-rules.test.js) pins it. `build:guides` owns `sitemap.xml` and lists the rule pages too.
  [rules.test.js](rules.test.js) (Node, CI) pins the parser, the pointers, the pages and
  the JSON.
- **PWA / offline**: the app is an installable PWA (scoped to `/app/`). Third-party libs (pdf.js + worker,
  pdf-lib, html2canvas, jsPDF, supabase-js, tus) and fonts are **vendored locally** in
  `vendor/` / `vendor/fonts/` (version-pinned filenames — not CDN), so the app is
  same-origin except Supabase. [sw.js](sw.js) precaches the whole shell for offline use;
  [manifest.webmanifest](manifest.webmanifest) + head meta make it installable.
  **`CACHE_VERSION` and `PRECACHE_SHA256` in [sw.js](sw.js) are GENERATED — never edit
  them by hand.** Both are stamped by `npm run build:sw`
  ([scripts/build-sw.js](scripts/build-sw.js)): the joint content hash that names the
  cache, and the per-file sha256 map the install uses to verify every fetched asset
  before caching it (a mid-deploy CDN serving a mixed shell aborts the install instead
  of poisoning the cache). Run it after changing any precached file
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
    modal (~3.8k lines; no inline JS logic except two deliberate snippets: the
    head supabase-enabled body-class stamp, and the body-tail boot sanity
    guard that surfaces the reload banner when app.js itself failed to load).
    Its `<script>`/`<link>` refs are root-absolute. Loads, in order:
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
    geometry.js), [conductor-model.js](conductor-model.js) (the pure raceway /
    conductor model — spec parsing, wire and cable rows, tick layout; after
    line-metrics.js; exposed as `window.ConductorModel`), [circuit-model.js](circuit-model.js)
    (the pure circuit model — tag, run graph, farthest device, panel
    cross-check; `window.CircuitModel`), [bid-check-model.js](bid-check-model.js) (the
    pure Bid Check rule table — NEC fill / voltage-drop arithmetic, the manual
    rows; `window.BidCheckModel`), [tag-model.js](tag-model.js) (the pure text-layer
    reading model — tag tokens, nearest tag, schedule rows; `window.TagModel`), [canvas-draw.js](canvas-draw.js) (the unified annotation
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
  - [app.js](app.js) — the main IIFE (~8.6k lines), the bulk of the app
    logic. Resolves the sibling modules' values by bare name, publishes the
    shared surface onto the `window.App` registry near its tail
    (`// SECTION: App feature registry`), and exposes its own helpers to
    report.js via `window.*`. Linted with `no-undef` as error, the rest of
    the recommended set as warnings.
  - **<!-- feature-count -->97<!-- /feature-count --> `features/*.js` registry files**, after app.js and before
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
  `getLineLengthForTotals`, `getLineLengthFeetForTotals` (per-line tally length
  converted to feet, for the per-line surfaces), `getLineLengthSplitForTotals`
  (the T1-05 `{ feet, px }` split — rollups keep the buckets separate and never
  sum px under a ft label), `getLineRealWorldLength`,
  `getMultiplyZoneForLine`,
  `getMultiplyZoneForPoint`, `getEffectiveScaleForLine`, `getMergedAnnotationsForPage`.
  It exposes `buildReportHtml`, `printReport`, `getPipeToolingSummary`,
  `getPipeToolingHasData` (cheap counts/lines/room-boxes existence check used by
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
  [save-engine.test.js](save-engine.test.js),
  [log-user-event-allowlist.test.js](log-user-event-allowlist.test.js),
  [teaching-labels.test.js](teaching-labels.test.js) (every `[[control]]` a tour or lesson names exists in
  the shell, and no guide uses a label in its `RETIRED` list: rename a control, add the old name there)) via
  `node --test`. All are dependency-free except [idb.test.js](idb.test.js),
  which uses the `fake-indexeddb` devDependency. [format.test.js](format.test.js)
  auto-skips its two en-CA-hyphen-dependent cases on a limited-ICU runtime and
  runs them on full-ICU (browser-equivalent / CI Node 20). Naming split (enforced by `testMatch` in
  [playwright.config.js](playwright.config.js)): `*.spec.js` = Playwright,
  `*.test.js` = Node unit tests.
- **Aggregate check**: `npm run check` runs [scripts/check.js](scripts/check.js),
  which executes EVERY step and reports all failures at once (one stale stamp
  no longer hides the next): lint + `test:unit` + `build:toc --check`
  + `build:filemap --check` (the ARCHITECTURE.md Large-file map line counts AND
  the "N `features/*.js` registry files" figure above — between its
  `<!-- feature-count -->` markers — are generated; see
  [scripts/build-filemap.js](scripts/build-filemap.js))
  + `build:projectmap --check` (three structural invariants, not counts: every
  shell script and `features/*.js` has an ARCHITECTURE.md Files row, no `App.*`
  read at LOAD time names something a later script registers, no unguarded
  `App.*` read names something nothing registers; see
  [scripts/build-projectmap.js](scripts/build-projectmap.js))
  + `build:macros --check` (the Macros table rows in app/index.html are
  generated from `HOTKEYS` in constants.js — edit the table there, then run
  `npm run build:macros` AND `npm run build:sw`)
  + `build:guides --check` + `build:rules --check`
  + `build:icons --check` (D18: [icons-custom.js](icons-custom.js) must match
  `my-counters/` — a symbol added without `npm run build:icons` fails here)
  + `build:sw --check`
  + `check-brand-tokens` (the styles.css ↔ marketing.css ↔ manifest token
  mirror) + `check-punchlist` (PUNCHLIST.md row shape + every `Detail` link
  resolves) + `check-lesson-rules` (a tour, lesson or course step that states a
  rulebook number or cites a code section names the rule, `rules: ['<id>']`, or says
  why not, `rulesExempt: '<why>'`, and its number is the rule's; see the rulebook
  bullet) — thirteen steps. Fast, no browser/cloud. Add new check steps to the `STEPS` table in
  scripts/check.js. [.github/workflows/ci.yml](.github/workflows/ci.yml)
  runs it on every push/PR (Node 20), plus an **e2e job** running the Playwright
  suite (chromium, own `npx serve` via the config's webServer; render-pixels is
  CI-ignored — darwin-rasterized baselines — and cloud-gated specs self-skip
  without dev-auth secrets; a stub `config.local.js` prevents the localhost-only
  include from 404ing). **Fresh clones/worktrees need that same stub locally**
  — `config.local.js` is gitignored so a new worktree doesn't inherit it, and
  without one the localhost-only include 404s, tripping every spec's
  no-console-errors assertion (~150 failures):
  `echo '// stub' > config.local.js` before running specs.
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
  `cleanup-test-accounts` (the pg_cron-invoked daily purge of week-old
  test-account projects + storage — see SUPABASE_SETUP.md),
  `invite-to-project`, `get-view-project`, `set-view-scale` (viewer sets a
  page scale for everyone; token + email-domain gated — both view-link
  functions share the `_shared/viewLink.ts` gate, whose
  `VIEW_LINK_EXEMPT_DOMAINS` list (default douglasmining.com, the dev/bot
  domain) always passes but never appears in user-facing copy),
  `twin-login` (digital-twin session mint for cloud agent harnesses — secret-header
  auth via `TWIN_LOGIN_SECRET`, estimator fleet email pattern +
  `profiles.is_digital_twin` required; see PipeTooling's `docs/DIGITAL_TWINS_PLAN.md`),
  `manage-user` (the CT↔PT user bridge — PipeTooling is the system of record for
  people and commands account provisioning/flagging/retirement here over
  `X-Bridge-Secret` / `CT_MANAGE_USER_SECRET`; server→server only, never a browser);
  `admin-reassign-projects` +
  `admin-delete-user` share the `_shared/reassignProjects.ts` ownership-move
  engine). Config via `config.js` (see
  [SUPABASE_SETUP.md](SUPABASE_SETUP.md)). PDF uploads capped at 50 MB.
- **Supabase migrations**: when creating or modifying files in
  `supabase/migrations/`, apply them via the Supabase MCP `apply_migration` tool
  (name = filename without `.sql`, query = file contents). Without the MCP, the
  CLI works with no database password: `supabase link --project-ref hrqxvfydmvtvwhvefmqc -p ""`
  (the CLI's login role connects), `supabase migration list --linked` to see what prod has,
  `supabase db push --dry-run --linked` (must list ONLY your file), then `db push --linked --yes`.
  If prod shows a version the repo lacks, `supabase migration fetch --linked` in a scratch
  copy reveals it (the MCP has recorded a file under an auto stamp before, 2026-09-13);
  rename the repo file to prod's stamp rather than repairing prod's history.

## Navigation

1. Read [RECONSTITUTE.md](RECONSTITUTE.md) for the core model, then
   [ARCHITECTURE.md](ARCHITECTURE.md) for the code map and feature catalog.
2. **Do not trust line numbers** — [app.js](app.js) is ~8.6k lines. Navigate
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
- Never call native `alert()` / `confirm()` / `prompt()` (B20 / X8). A notice is
  `App.showToast(msg, ms)`; a question or a text prompt is
  `await App.confirmDialog({ title, body, confirmLabel, danger, input, infoOnly })`
  (`Promise<boolean | string | null>`; Esc cancels; it sits above every other modal),
  so the calling function becomes `async`. In specs, drive it by clicking `#confirmOk` /
  `#confirmCancel` (or filling `#confirmInput`) — a `page.on('dialog')` hook is a
  failure signal, never a driver.
- **Modal primitives (2026-09-18 polish pass).** A dialog is a `.modal-card` with a
  `.modal-card-header` (title, optional `.modal-card-sub`, and a × carrying `data-modal-close`,
  which app.js dismisses the way Esc does). Action buttons in `.actions` carry a role class
  (`ghost` / `primary` / `danger` / `danger-ghost` / `link`), never rely on first/last position;
  a destructive button sits left with `margin-right:auto`. Sliders are plain
  `input[type=range]` under a `label.range-label` (value in `.range-val`), colour pickers are
  `.color-field` (the input plus a `.color-hex`), a label-left / control-right row is
  `.setting-row` + `.setting-label`, a group heading is `<div class="section-rule"><b>…</b></div>`,
  a numeric field with a unit is `.field-unit`, Straight/Curved-style radios are `.radio-seg`,
  a nothing-here list is `.empty-state`. Check a change across every dialog at once in the
  Modal Gallery (`/app/?gallery=1`).
- Copy style (2026-09-14 pass): no em dashes in user-facing text — a comma, colon,
  period or the house ` · ` separator instead (a lone `—` as an empty-value cell is
  fine). In a tour step body, name a control the way it looks on screen with
  `[[+ Add]]`; features/tutorial.js renders it as a `.tour-ui` chip. Write the body as
  lines, one action per `1. …` line (where the control is, what to click, what to
  type); the renderer numbers them. A tour or lesson step that works ON THE SHEET declares `zones`
  (circles for clicks, a boundary for a drag, in sheet points) and its `check` counts only
  what is inside them; never add a button that does a step for the reader (the owner's
  call, 2026-09-21). `action.run` is the spec and screenshot seam `App.tutorialDoStep()`.
- **Recording a to-do.** When the user asks for something to be noted for later
  ("add a to-do", "someone should…", "make sure we come back to this"), it goes in
  [PUNCHLIST.md](PUNCHLIST.md) — never only in the conversation, never only in a
  branch that may not merge. The recipe:
  1. **Add the row first, before the work it came out of.** One line, six cells:
     a stable `ID`, the item in trade language, `Kind` (bug · build · decision ·
     test · chore), `Who` (agent · dev · tester · ⚑ call), `Blocked by`, `Detail`.
  2. **Land it within minutes, not at the end of the task.** A one-file branch off
     the latest `main` (`claude/punch-<id>`) that merges immediately — the house
     "never commit on `main` directly" rule still holds, but this branch is never
     left open. A to-do that sits on an unmerged feature branch is a to-do nobody
     can find.
  3. **One line, or a link.** If the item needs more than a line, write the detail
     into the document that owns it (the plan file, the dossier, `_STAGE6.md`) and
     point the `Detail` cell at that heading. A row must never be the only copy of
     anything, so there is exactly one place to be wrong.
  4. **Don't rank it.** Priority lives in [JOURNEY-MAP.md](JOURNEY-MAP.md)'s tiers.
     Rows are in insertion order; if the user says it is urgent, say so in the item
     text and set `Who` to `⚑ call` when it needs a product decision first.
  5. **Closing a row deletes it**, and the outcome is recorded where the work
     landed (CHANGELOG, the plan file, the dossier). A done row left in the list is
     a bug in the list.
  `npm run check` runs [scripts/check-punchlist.js](scripts/check-punchlist.js),
  which fails on a malformed row, a duplicate ID, a `Blocked by` naming no row, or
  a `Detail` link whose file or heading anchor does not resolve.
- `makeAnnotations()` is the canonical annotation shape; new annotation kinds must
  be added there and to save/load + export/import.
- A palette item's `childCounts[]` rows are `{ name, qty, per: 'count'|'run'|'ft', ftInterval?, intervalIn?, ruleId? }` — `intervalIn` (inches) wins over the whole-foot `ftInterval`; `ruleId` names the rulebook rule a row was taken from (the § chip). Palettes serialize wholesale, so both ride save/load, export/import and the Artboard for free.
- Electrical fields ride existing objects, never new ones: a line type's `raceway`
  / `conductors` / `tickMarks` / `homerun`, a line's own `conductors` / `homerun`, a
  counter's `mountHeightIn` / `cablePerCount` / `panelName` / `poles`, a counter's `tag`, a group's
  `panel` / `circuit` / `loadAmps` (palettes serialize wholesale; a line's
  override rides the annotation). Wire and cable are DERIVED at tally time
  (features/conductors.js) — never marks, never stored totals. Plumbing's fixture units
  ride the same way (WATER-PLAN rung 2): a counter's `wsfu` (+ `wsfuOccupancy`, the
  counter's own public | private column, absent = the project's), a mark's
  `wsfuOverride` (features/water-fixtures.js; the tables in water-model.js), and a line
  type's `waterSide` (`'cold' | 'hot'`, rung 3, features/water-runs.js: every line of
  the type is a water run; fixtures attach per side by proximity, never stored).
- Keep the app functional with Supabase disabled.
- **Feature flags (dormant ships).** A change that must land on main before a tester has
  walked it on the real site ships OFF behind `featureFlagEnabled('<name>')` (app.js
  `// SECTION: Feature flags`): `/app/?ff=<name>` turns it on for that device (localStorage
  `clickcount-ff-<name>`, survives sign-out on purpose, never rides a project), `?ff=-<name>`
  turns it off, `?ff=a,b` several. The engine reads flags through `ctx` (e.g.
  `isSelfReleaseStampEnabled`). A flag is a staging area, not a settings surface: the
  follow-up "flip" PR makes the behavior the default and deletes the reads. Live flags are
  listed in that section's comment.
- When adding a new persisted setting or per-project field, include it in
  export/import and save/load.

### `window.App` registry (splitting app.js)

`app.js` is one ~8.6k-line IIFE, so feature code that moves to a separate
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
`lengthLabelSize`, `snapToHorizontalVertical` (the 8-way 45° snap toggle — the
key keeps its original H/V-era name so saved settings aren't orphaned),
`showOnlyLinesOnCurrentPage`; both settings objects carry `sidebarFilterScope`
— the `'off' | 'page' | 'project'` sidebar usage filter, superseding the legacy
`showOnlyCountersOnCurrentPage` / `showOnlyLineTypesOnCurrentPage` booleans,
which are kept in sync (`true` only for `'page'`) so the settings shape is
unchanged; the scope ALSO persists per device via the localStorage keys
`counterSidebarFilterScope` / `lineTypeSidebarFilterScope` — written by the
`set*ListFilterScope` setters, read at boot, wiped by the sign-out key list),
`legendSettings` (includes `style`: `'tally' | 'compact' | 'full'`, the on-plan legend's drawing; absent = by trade, compact for electrical and HVAC, tally for plumbing; the block also scales with the sheet's long side, canvas-draw `legendSheetFactor`), `multiplyZoneSettings`, `scaleZoneSettings` (the on-zone scale
label: show/size/position, default top-left; per-project in save/load +
export/import like `multiplyZoneSettings`), `gridSettings`, `showGridOverlay`,
`exportSettings` (includes `bundleHighlightsToPdf`, `bundleNotesToPdf`),
`recentRoomHeights` (Room Sizer recent ceiling heights, decimal feet, max 5),
`recentBids` (the header bid switcher's list, `{ id, name, at }` newest-first, max 5, per device; pure core `nextRecentBids` in recent-bids.js, written by `recordCurrentBidAsRecent` on every updateUI whose bid changed, wiped by the sign-out key list; the menu reads THIS rather than the cloud because `list_accessible_projects` returns every project's whole `data` payload),
`recentLineColors` (shared recent-color list, written by `pushRecentColor` —
custom/off-palette colors only, presets skipped; consumed by the edit color
picker and the Create Counter / Create Line Type pickers), `iconNames`,
`iconOrder`, `pageScales`, `zoomSettings`,
`groupColorDisplay`, `pagesTitlesTruncated`, `hideUnmarkedPagesFromSidebar`,
`counterSearch`, `lineTypeSearch`, `linesSearch`, `linesTypeExpanded`,
`paletteInsightsMinProjects` (the Palette Insights min-projects threshold),
`loadProjectFiltersExpanded`, `loadProjectAdvanced` (admin-only; shows the Load
Project rows' "Who has access" block), `plumbingModifiers` (includes `iconByType`; since S1 also `profiles[trade]` — the electrical / HVAC Quick profiles, each `sizes`/`types`/`materials`/`iconByType`/`mountByType`/`defaultColor` — and `defaultTrade`, the device's default for new projects; the whole blob rides `user_airboard.plumbing_modifiers`),
`lineModifiers`, `specificPagesIncludeReport`, `clickcount-tour-done` / `clickcount-tour-done-plumbing` / `clickcount-tour-done-hvac` (the electrical / plumbing / HVAC walkthrough was finished on this device — hides that tour's empty-canvas link; the whole offer goes when all three are set),
`clickcount-lessons-done` (Learn: `{ <lessonId>: ISO }`, the lessons finished on this device; features/lessons.js),
`clickcount-lesson-device-before` (the reader's sidebar filter, Snap and search words as a lesson found them; written when a lesson starts, removed when it stops, and put back on the next load when a reload or a closed tab skipped the stop; features/lessons.js),
`clickcount-tour-searches-before` (the same for a TOUR's sidebar search words: cleared while the five-minute or blank tour runs, typed back when it stops or on the next load; features/tutorial.js),
`clickcount-lesson-palette` (LEARN-LEAK: `{ standing, made }`, the palette ids that stood when a lesson's, course's or tour's sheets opened and the ones made while they were open; the made ones are removed when the reader leaves the sheets, even after a reload mid-lesson; features/lessons.js),
`clickcount-last-project`,
`clickcount-last-global-reload`, `clickcount-debug-save` (Save Status Verbose
mode), `clickcount-ff-<name>` (feature flags — per device, set by `?ff=<name>`,
NOT wiped by the sign-out key list; see Conventions), `chainPanelPos` (the dragged Chain palette position, per device;
ignored when it no longer fits the viewport), `dropPanelPos` (same, for the
Drop tool palette), `highlightPanelPos` (same, for the Highlights bookmarks
panel — features/highlight-labels.js; the highlight *labels* themselves ride
the annotations, not localStorage), `recentDrops` (the last 5 drop sizes as
`{ value, unit }`, per device — the shared vocabulary behind the Line
Properties Recent chips and the Drop tool palette; pure core
`nextRecentDrops` in recent-drops.js), `clickcount-show-drop-sizes` (the
"Drop sizes" canvas-label toggle for non-view sessions, per device — a visual
preference like hide-marks, deliberately NOT in project save/load; view-link
sessions use `view:dropSizes:<token>` instead — see features/drop-peek.js).

- `numberKeyBindings` (Quick Keys) is per-project in save/load/export/import, AND
  rides the cloud Artboard (`user_airboard.number_key_bindings`) so a standard
  palette carries its number row into new bids — lifecycle rules in
  features/quick-keys.js (`seedQuickKeysFromArtboard` / `applyProjectQuickKeys`).
- `customIconPaths` lives in **IndexedDB** (in-memory cache, per-user key; one-time
  migration from localStorage / legacy key).
- Per view token (localStorage): `view:allowed:<token>` (accepted viewer email),
  `view:hideMarks:<token>`, `view:dropSizes:<token>` (the viewer's "Drop sizes"
  toggle — features/drop-peek.js), `view:scale:<token>` (the viewer's temporary local
  page scales — the offline fallback when the shared `set-view-scale` write
  fails; a page-index → scale map, server scale wins on restore).
- Per-project, in save/load: `stripPins` (D21 — the header strip's per-tool
  overrides: `{ [btnId]: true | false }`, `true` = pinned inline, `false` =
  explicitly behind the ⋯, absent = follow the STATED trade profile — and a
  project that has never named a trade keeps D14's shipped arrangement
  (features/header-more.js). Rides save/load, export/import and all four
  intakes like `groupsEnabled`; ALSO mirrored to the localStorage key
  `stripPins` so a plain reload keeps the device's arrangement and seeds the
  next bid — the both-places rule the sidebar filter scope uses. Wiped by the
  sign-out key list.)
- Per-project, in save/load: `codes` (rulebook slice 4 — `{ plumbing?, electrical?, hvac?, jurisdiction?, occupancy? }`, only what the project CHOSE (null = never chosen; `occupancy` is `'public' | 'private'`, the fixture-unit column the project reads, WATER-PLAN rung 1, set from the flip word in Project Settings' Codes row hint and resolved to public when unchosen); `getProjectCodes()` layers the device default (localStorage `codesDefault`, written on every change like `defaultTrade`) and `CODE_DEFAULTS` under it; rides every intake beside `ceilingHeightFt` — save payloads, hydrate, the IndexedDB backup, canvas JSON export/import, copy/load/pdf-intake), `trade` (`'plumbing' | 'electrical' | 'hvac' | null` — the Quick creator's vocabulary and the handoff's stamp; explicit, set from the Quick tab's Trade segment or Project Settings, null = never chosen = plumbing behavior), `ceilingHeightFt` + `makeUpFt` (vertical by default — with a counter's `mountHeightIn` the Chain tool writes ceiling − mount + make-up as the run's drop; Room Sizer rooms override the ceiling; null ceiling = off), `bidCheck` (S5 — `{ manual: { <row-id>: true }, loadAmps?, volts? }`: the Bid Check's manual ticks and the voltage-drop defaults; the auto verdicts are computed, never stored; D9 adds the duct rows — `duct-*` ids from duct-model's `DUCT_BID_CHECK_ROWS`, ticked in the same `manual` map once the project has a duct run), `maxZoom`, `groups`, `ductSettings` (the Duct
  Schedule knobs — `seamWastePct` (+15 default), `fittingFactorPct` (40) and
  the Counted|Factor `fittingMode`, plus the D6 design-build ductulator knobs
  `frictionInPer100ft` (0.08) and `maxVelocityFpm` (1200), edited on the
  schedule modal's Suggestions row, and the D8 polish knobs on its Polish row:
  `deckHeightFt` (null = unset; arms the auto-riser on equipment-started runs — D17: also
  editable from the Duct create modal and the Room Size dialog of an HVAC-shaped project,
  all three through the ONE writer `App.setDuctDeckHeight`, which re-applies the auto riser
  to every committed equipment-started run),
  `maxFlexFt` (6, the single-drop flex warning cap) and `countVdPerTap` (true —
  a Volume damper fittings row per tap; absent in pre-D8 saves ⇒ true), and the
  D11 static-path knob `terminalAllowanceInWg` (0.10 — the diffuser + flex
  allowance added once at the end of the critical path; on the Suggestions row);
  defaults in app.js state init, restored by
  every intake like `legendSettings`), `waterSettings` (WATER-PLAN rung 5 — `{ capFps: { cold, hot } }`, the Water Sizing
  schedule's velocity caps per side, defaulted from water-model's `WATER_SETTINGS_DEFAULTS` (8 / 5 fps) and normalized
  by `normalizeWaterSettings` on every intake ductSettings rides; the schedule's occupancy knob writes the codes blob), `groupsEnabled` (the Groups
  UI gate — the sidebar section + Assign-to-Group menus show only when this is
  true OR the project has groups; latched true on first group create; restored
  by BOTH shared hydrate paths and the copy/load/import intakes), `rooms` (Room Sizer palette — a room carries `nameFromPlan: true` when D24 read its name off the plan's text layer, which switches its label to the once-per-room totals tag;
  each canvas's `annotations.roomBoxes` references a room id), `activeCanvasIdByPage`. Each saved
  page also carries `bakeFrame` `{ w, h, intrinsic }` (the viewport dims at `page.rotation`
  + the PDF's intrinsic `/Rotate`) so a later load / view-link viewer can detect when the
  loaded PDF would render the page in a different orientation than the marks were baked
  against (`computePageBakeFrame` stamps it, `verifyPageBakeFrame` checks it on load via the
  pure `bakeFramesMatch`; on mismatch it warns + toasts + sets `page.bakeMismatch`, never
  auto-corrects). Each saved page also carries `label` (the custom sheet name from the
  pages-sidebar rename / Prepare PDF), restored by `applyPageAnnotationsFromData` over the
  caller-seeded default. The IndexedDB takeoff backup carries the parallel
  `pageBakeFrames` and `pageLabels` arrays.
- In-memory only (not persisted): `state.pdfBufferSize` (bytes; set whenever
  `state.pdfBuffer` is set, because pdf.js detaches the buffer making `byteLength`
  0), `state.localPdfHash` (sha256 of a locally-uploaded, never-saved PDF —
  stamped by features/pdf-intake.js; NOT `state.pdfHash`, which carries
  cloud-PDF semantics; rides signed-out IndexedDB backups so a same-PDF
  re-upload can hash-verify the re-apply),
  `state.userActivityAllRowsCache`, `state.userActivityViewMode`,
  `state.showAllCanvases` (the desktop show-all-layers peek toggle),
  `state.parkedScaleDraft` (D20 — a live polyline / quick-line draft held
  across the Set Scale modal and resumed when it closes; one modal
  round-trip long, never persisted),
  `state.counterAirMoreOpen` (D19 — the Counter modal's "More ▸ air &
  mounting" disclosure on the Create and Quick Count tabs: null = follow the
  trade (open on hvac/electrical), true/false = the estimator's override for
  this project; a view preference like the peek, reset with the project by
  `resetLocalSessionState`),
  `state.emphasizedCounterId` (the "find this counter" halo — counter-type id
  whose markers ring on the live overlay; toggled by clicking a marker,
  features/drop-peek.js),
  `state.peekCanvasIdsByPage` (the peek's optional per-page layer subset —
  pageIdx → canvas-id array chosen via right-click on `#showAllCanvasesBtn`;
  active layer always implied, empty array = active only, absent = all).
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
  A demotion seen at `refreshProjectPermissions` is CLASSIFIED before anyone is
  blamed: our own release (the engine's self-release stamp `noteSelfRelease`,
  window `SELF_RELEASE_GRACE_MS`, scoped to the project that was released;
  `doTurnIn` and app.js's
  `checkInCurrentProjectIfHeld` both stamp) → `self_release_refresh`, nothing
  shown; a stale lock → the expiry machinery; a LIVE lock cleared by someone
  else (an admin, or another tab/device signed in as this user — the RPC is
  per user) → the force-turn-in notice modal. **The self-release rung is
  DORMANT behind `?ff=self-release` until _TODO.md R1-FLIP** (with the flag off
  our own Turn In still shows the notice — the 2026-09-15 field bug). Pinned by
  save-engine.test.js and [turn-in-self-release.spec.js](turn-in-self-release.spec.js)
  (cloud-gated, both halves).

### Hotkeys

**Single source: `HOTKEYS` in constants.js** — the keydown handler executes it
and `npm run build:macros` renders the Macros table from it (Keyboard Map
derives from that table). Add/change a hotkey THERE, never in the table markup.

Tool enum note: `TOOL.SCHEDULE` (S6, the schedule-box rect tool) has no hotkey — it
is armed from the Counter modal's Create tab.

1-9/0 (Quick Keys — user-bound counters/line types, per project), M (Move),
S (Set Scale), C (Counter), L (Line modal), J (Snap to 45°), P
(Polyline), U (Duct — D18; D was taken, so the first free letter of "Duct";
mid-trace S steps the duct size instead of Set Scale; a polyline of a water-sided line type does the same with the water size popover, WATER-PLAN rung 4, features/water-size.js), T (Chain — counter +
connecting line per click), B (Drop — one
click per line end adds the palette's rise/fall), D (Measure),
H (Highlight), X (Multiply Zone), V (Room Sizer), N
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

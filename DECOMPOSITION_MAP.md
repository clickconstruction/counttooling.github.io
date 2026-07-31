# Decomposition Map — every file in the repo

Generated 2026-07-30 by a 13-agent sweep of the whole repository (each file read and assessed
individually; line counts verified with `wc -l`; verdicts cross-checked against the
ARCHITECTURE.md "Large-file map" and Files table). Purpose: a single decision document for
choosing **what to decompose next** to keep the codebase manageable.

Verdict vocabulary:
- **leave** — right-sized or format-mandated; splitting would add cost, not clarity
- **done** — already an extraction product; nothing left to move
- **candidate-now / split-candidate** — a clean seam exists today
- **candidate-later / watch** — split only if it keeps growing; seam pre-identified
- **dedupe-first** — internal duplication is the real problem; dedupe shrinks it below the
  threshold where a split would matter
- **generated / n-a** — build artifact or data; never hand-decomposed

Repo totals: 1,130 git-tracked files — 565 in `node_modules/` (tracked despite `.gitignore`,
see Defects §D8), 209 in `vendor/`, 135 at root, 67 `supabase/`, 48 `my-counters/`,
44 `features/`, 23 `guides/` (generated), 12 `content/`, 11 `scripts/`, remainder assets.


> **STATUS 2026-07-30 (evening):** items 1–8 of the working shortlist are DONE on main:
> D1 (prepare-pdf fix, merged), report.js collectSummaries (D2b fixed; D2a was a false
> finding), #plumModal deleted (D14), hygiene batch (D4–D6, D9–D11 — D11 actually needed
> five doc rows), config.toml aligned (D3), node_modules untracked (D8), **pdf-tile-cache
> stage 1 extracted** (Tier-1 #1; app.js 8,062 → 7,620), sidebar renderers extracted
> (Tier-1 #2; → 7,411), undo-stack.js split (Tier-2 #6). Remaining from §1: Tier-1 #3–#5
> (status bar, summary/canvas-switcher renderers, Turn In), Tier-2 #7–#8 (constants split,
> report.js file-level), Tier-3/4.
>
> **STATUS 2026-07-31:** the follow-up batch N1–N12 is also DONE on main: save-project
> preflight named + specced (6 tests), my-counters names fixed (48→45 icons),
> features/status-bar.js (Tier-1 #3), features/canvas-switcher.js + summary-list.js
> (Tier-1 #4), pdf-tile-cache STAGE 2 (crop tile + tile grid — substrate complete),
> hydrateStateFromProjectData in annotation-model (Tier-3 #12), svgShapeToPath pure +
> custom-grid dedupe (Tier-3 #13, picker-side renderIconGrid still open),
> features/turn-in.js (Tier-1 #5), user-admin/user-activity low-risk dedupes (Tier-3
> #10/#11 — row-HTML unification + line-301 split still open), supabase _shared
> adminGuard/json/viewLink (Tier-4 #20 — **committed but NOT deployed**), constants.js
> split into zoom-ladder/hotkeys/recent-colors (Tier-2 #7), and the Playwright suite now
> runs 4-worker per-file parallel (6.7m → 2.1m). app.js: 8,062 → ~6,300. Remaining
> highlights: report.js file split (optional), load-project L653 split, user-activity
> split, renderIconGrid picker dedupe, scripts/lib + eslint-factory tooling items, and
> deploying the refactored edge functions.
>
> **STATUS 2026-07-30 (session 3, ranked-table batch):** #0 stray tool-call scaffolding
> (`</content>`/`</invoke>`) removed from content/guides/working-offline-and-installing.md
> + regenerated page (was rendering as visible body text on the live Help site).
> #1 Tier-4 #20 deploy VERIFIED DONE: all 9 edge functions redeployed 2026-07-31
> 01:33–01:37 UTC, ~30 min after the _shared refactor commit (0c6f173) — the
> "committed but NOT deployed" flag above is stale; no action was needed.
> #2 view-only.spec.js added (5 tests, always-run — get-view-project stubbed via
> Playwright routes): email gate, hydration + viewer flags, domain_restricted
> re-prompt, cancel, and the IndexedDB offline-snapshot fallback. Closes the
> §2/§10 "no view-only.spec" gap; viewer-scale.spec.js still owns the scale layer.
> #3 share-links.spec.js 56 → ~320 lines (1 → 8 tests, all always-run): the RPC
> surface covered via an App.getSupabase() fake-client stub (the feature's own
> call-time accessor rule makes this a supported seam) + a routed invite-to-project
> stub — render/escaping, role change, remove, confirm-gated revoke + onViewLinkRevoked
> hook, access log, create, invite success/failure, error surfacing, viewer gate.
> #4 save-engine untested-cluster tests: +14 node cases (raw-REST wrappers'
> full contracts, sha256Hex vector, the PDF upload ladder driven through
> performSaveProjectToCloud incl. the verify-after-timeout net and failure
> path, uploadLocalPdfToCloudIfNeeded skip ladder). §2's "close that gap
> before extracting the upload cluster" prerequisite is now met.
> #5 Tier-3 #14 DONE: features/load-project.js split at its documented L653/655
> boundary → features/copy-project.js (329 ln: copy/fork domain + save-before-load
> gate + hydrate/resolve/build helpers, 7 registry names unchanged), and
> renderLoadProjectListRows decomposed along its action boundaries (size / row
> HTML / actions / admin access / load click; the renderer is now a thin loop).
> load-project.js 969 → 693. New shell file: script tag + PRECACHE_URLS +
> build:sw restamped; ARCHITECTURE rows updated (incl. the stale "gate stays in
> app.js" claim); copy-project.spec.js added (4 always-run tests). Full
> Playwright suite green (180 passed).
> #6 Tier-3 #13 CLOSED: shared picker-grid cell builders (iconCellHtml /
> iconGridCellsHtml / customIconCellsHtml) in icon-render.js (+3 node tests)
> replaced the 8 copy-pasted cell-markup blocks across counter.js /
> item-details.js / quick-modals.js / custom-icon-upload.js (click wiring
> stays per-picker); custom-icon-upload.spec.js added (3 always-run tests,
> real FileReader/DOMParser upload path incl. rejection).
> #7 summary-detail perf item fixed: thumbnail loop is generation-token
> cancelled on modal close/re-open (core→feature callback
> App.onSummaryCountDetailHidden in hideModal) + the in-flight pdf.js
> RenderTask is cancelled; spec extended to pin it (§6's "no cancel on modal
> close" note is resolved).
> #8 D7 FIXED: config.js/config.example.js headers now state the truth (the
> file is committed; anon key is RLS-gated public; secrets go in
> config.local.js), and generate-config.js refuses to overwrite the
> git-tracked config.js (CONFIG_FORCE=1 to override).

---

## 1. Ranked master shortlist

### Tier 1 — app.js extractions (the only file the repo docs say is worth actively shrinking)

| # | Extraction | Seam type | Yield | Why first |
|---|---|---|---:|---|
| 1 | **PDF bitmap cache + pyramid + prefetch + warm-up + crop tile + tile grid** (app.js 1393–2178) → `pdf-tile-cache.js` `createPdfTileCache(ctx)` | seam module (save-engine mould), stageable in 4 steps | **~780** | Lowest state coupling of any large region (42 `state.` refs over 4 fields); **nine** Playwright specs already pin behavior; five `App.__*` debug seams already exist. **Missing from ARCHITECTURE.md's own decomposition table** — add it there. |
| 2 | Sidebar list renderers (`renderCountersList`, `renderLineTypesList`, `renderGroupsList`, `renderPagesList` + paired collapse/search handlers at 4692–4833) → feature files | feature file(s), replay of the proven `features/lines-list.js` recipe | ~290 | 1–5 inbound sites each, one DOM container each, zero moved state, 8 of 12 deps already published. |
| 3 | Status bar + footer totals (`updateStatus`, `getCloudSaveSummary`, `updateSaveStatusIndicator`, `computeFooterTotals` cluster, app.js 1134–1384) → `features/status-bar.js` | feature file | ~250 | Pure DOM chrome over `state` + saveEngine getters; misfiled under "Math & Format Helpers"; neighbor `features/save-status.js` already exists. |
| 4 | `renderSummary` (133 ln) + `renderCanvasSwitcher` (112 ln) → `features/summary-list.js`, `features/canvas-switcher.js` | feature files | ~245 | One inbound call site each (both from `updateUIInner`); their modals already live in feature files. |
| 5 | Turn In result UX (`doTurnInAndHandleResult`, `tryTurnIn`, `handleEditStatusBannerClick` + `#settingsCheckOut/CheckIn/ForceCheckIn` handlers, app.js 5348–5612) → `features/turn-in.js` | feature file | ~230 | The only `[sync]` section that is real code, not wrappers (0 delegates, 32 DOM refs). Caveat: interleaved with Project Settings checkout (5191–5347) — untangle first. |

Combined Tier-1 yield: **~1,795 lines** → app.js from 8,064 to ~6,270 without touching
`updateUIInner`, the input layer, or boot.

### Tier 2 — root modules

| # | Item | Action | Yield / benefit |
|---|---|---|---|
| 6 | `annotation-model.js` (614) | **Split**: extract `createUndoStack` → `undo-stack.js` (~135 ln). Two unrelated factories share the file; zero call-graph edges; different ctx contracts; app.js already instantiates them at two distant points. Cost: one `<script>` tag, one eslint `require()`. | clean 2-way split |
| 7 | `constants.js` (287) | **Decompose the grab-bag**: (a) zoom ladder (`ZOOM_LADDER_*`, `snapZoomToRung`, `nextRungUp/Down`) → `zoom-ladder.js`; (b) `HOTKEYS` table → `hotkeys.js` (update `scripts/build-macros.js` same commit); (c) `nextRecentColors` + `RECENT_COLORS_MAX` out. Leaves ~190 lines of genuinely coherent literals. IDB store-name block → idb.js is possible but riskiest; do last or never. | header's "literals only" claim becomes true again |
| 8 | `report.js` (513) | **Refactor internally, don't split**: extract one private `collectSummaries({pageIndices, getAnn})` — the three builders (`buildReportHtml`, `getPipeToolingSummary`, `getEmailTextSummary`) each re-implement the same aggregation walk (~120 duplicated lines). Fixes two live bugs as a side effect (Defects §D2). Frozen `window.*` surface unchanged. | −120 ln + 2 bug fixes |

### Tier 3 — features/ (dedupe-first; file splits mostly optional afterward)

| # | Item | Action |
|---|---|---|
| 9 | `features/quick-modals.js` (462) | **Confirm `#plumModal` is dead** (`#plumBtn` redirects to Quick Count; `App.populatePlumModal` has no consumer outside its own spec) and delete the Plum cluster + markup → ~250 ln. If it must live, collapse both near-verbatim clusters into one `createQuickCountPanel(prefix)` factory. Fix its load-time `App` destructure first (only boundary-rule violation in Q–Z set). |
| 10 | `features/user-admin.js` (453) | **Dedupe, don't split**: one `fetchAdminUsers()` ladder + one `renderUserRow(u, {actions})` (two near-identical list implementations); one `openConfirmDialog`/`submitAdminAction` pair (the same 5-step dialog shape ×5); one `adminHeaders(session)` (6 inline copies). → ~250–280 ln. |
| 11 | `features/user-activity.js` (459) | The only genuine two-features-in-one-file case; seam already drawn at line 301, zero shared symbols. **First** mine ~60 lines of pure timeline/timezone formatting into `format.js` (gains node tests); then the split (`user-activity.js` ~270 + `user-activity-overview.js` ~190) is optional. |
| 12 | `view-only.js` (326) + `restore-last-session.js` (238) | **Highest-leverage cross-file dedupe in features/**: `view-only.js:270–294` ≈ `restore-last-session.js:99–127` (page construction + project-data hydration, near-identical). Move to `annotation-model.js` as `hydrateStateFromProjectData(d)` next to `applyPageAnnotationsFromData`. −30 ln each, one home for the hydration contract. |
| 13 | `features/custom-icon-upload.js` (173) | The one grab-bag in A–I: mine the pure SVG→path parser into a node-testable module (only nontrivial untested pure logic in features/); add a shared `renderIconGrid(gridEl, icons, {selected, onPick})` — the grid-build pattern is copy-pasted **~6×** across `counter.js` (3×), `item-details.js`, `custom-icon-upload.js` (4 blocks), `quick-modals.js` (2×). → ~60 ln. |
| 14 | `features/load-project.js` (969) | **Watch; seam pre-identified**: cut at the file's own documented line-653/655 domain boundary → `load-project.js` (~650, browser/filters/rows/load) + `copy-project.js` (~315, copy/fork + save gate). Zero new registry surface (all seven cross names already published). Prerequisite: decompose `renderLoadProjectListRows` (365 ln) internally along its action boundaries. Not "modal UI vs data-fetch" as ARCHITECTURE.md suggests — that cut runs through interleaved code. |
| 15 | `features/item-details.js` (392) | Move `deleteGroup` to `features/groups.js` now (zero-risk, restores domain ownership — groups.js already consumes it via `App.deleteGroup`). The details-modal / line-properties 2-way split is clean but optional; revisit at ~500 ln. |
| 16 | `features/output.js` (416) | Low-priority 3-way split seam visible (copy cluster / download-page / shared PDF helpers). The shared helpers' placement is what broke prepare-pdf (Defects §D1) — rehome or fix load order as part of that bug fix. Dedupe the 4 near-identical mm-conversion branches in `downloadCurrentPageAsPdf` regardless. |
| 17 | `features/pdf-intake.js` (357) | **Internal extraction first**: 82% of the file is one anonymous 290-line `onchange` arrow. Name the outcome branches (`handleAppendPages`, `handleFreshUpload`, `matchPendingCanvasLoad`, `promptLoadAnnotations`); the binding becomes a 3-line dispatcher. |

### Tier 4 — tooling and cloud

| # | Item | Action |
|---|---|---|
| 18 | `scripts/lib/` extraction | ~120-line shared lib removes real duplication from 9 of 11 generators: `markers.js` (BEGIN/END replace — identical in build-toc + build-macros), `app-icons.js` (**byte-identical** icon-extraction regex in build-macros + build-guides), `artifact.js` (the `--check` protocol, hand-rolled 5 ways — adopt build-guides' Map-diff form), `brand.js` (the reticle glyph is triplicated), `render.js` (Chromium `withPage` boilerplate ×4). |
| 19 | `eslint.config.js` (429) | Collapse the 8 verbatim-identical rule blocks with a `browserModule(files, globals, opts)` factory (~180 ln removed, comments preserved as argument-site notes); derive `projectGlobals` for report.js instead of hand-maintaining it. |
| 20 | `supabase/functions/` (550 ln TS) | Three `_shared/` extractions: `adminGuard.ts` (`requireUser` + separate `requireAdmin` — 7 functions copy-paste the prologue and one has already drifted), `json.ts` (promote set-view-scale's `jsonRes`; ~60 repeated response-header literals), `viewLink.ts` (`getAllowedDomains`/`emailDomainAllowed` are byte-identical in the two view-link functions). ~150–200 ln removed; drift eliminated. Resolve the `config.toml` gap first (Defects §D3). Do NOT merge functions — one-function-per-endpoint is load-bearing. |
| 21 | `scripts/build-guides.js` (293) / `build-screenshots.js` (334) | build-guides is a real SSG (front-matter/layout/icons/sitemap seams); build-screenshots should separate the generic static server + declarative `SHOTS` manifest from the app-internals-coupled fixtures (the fragile part). Both feed §18. |
| 22 | `npm run check` | Replace the 7-clause `&&` chain with `node scripts/check.js` that runs every stamper's `--check` and reports all failures at once. |

---

## 2. Defects found during mapping (fix regardless of decomposition)

| # | Defect | Where |
|---|---|---|
| **D1** | **LIVE BUG**: `features/prepare-pdf.js:10-15` destructures `sanitizeForFilename` / `downloadPdfBuffer` from `App` **at load**, but both are registered by `features/output.js`, which loads 4 `<script>` tags later — both locals are `undefined`, so the `#preparePdfDownload` handler (L363–371) throws a guaranteed TypeError. Untested (`prepare-pdf.spec.js` never touches it). Fix: call-time reads. Same violation, currently benign: `features/pdf-bundle.js:6-9`, `features/quick-modals.js:8-12`. | prepare-pdf.js |
| **D2** | ~~FIXED 2026-07-30~~ (`collectSummaries` refactor). Verification note: claim (a) was a **false finding** — `getEmailTextSummary` already iterated `pageIndices`; only (b), the unsorted PipeTooling group order, was real. | report.js |
| **D3** | `supabase/config.toml` lists `verify_jwt = false` for 7 functions but **omits `admin-set-password` and `admin-reassign-projects`** (gateway default = true for those two). SUPABASE_SETUP.md describes all admin functions as verify_jwt=false, suggesting the config is stale. Resolve explicitly before the adminGuard extraction. | supabase/config.toml |
| **D4** | `format.js:136` — `renderUserActivityAllUsersTableHtml` defines a private `esc` that omits the `'` → `&#39;` entity the file's own canonical `escapeHtml` (4 lines above) exists to guarantee. | format.js |
| **D5** | `idb.js:16` header says "version 6 … 9 stores"; code opens **v7** and creates **10** stores (`zoom_rungs` missing from the header list). | idb.js |
| **D6** | `constants.js` — the CommonJS-footer comment is severed in half by the `HOTKEYS` block pasted into its middle (L214-215 vs orphan at L260). | constants.js |
| **D7** | `config.js` header comments claim it is gitignored — false (`.gitignore` only lists `config.local.js`; the file is committed with the production anon key — likely intentional for a static deploy since anon keys are RLS-gated public, but the comments assert the opposite). Also: `scripts/generate-config.js` (via `npm run test:cloud`) silently **overwrites this tracked file** when `SUPABASE_URL`/`SUPABASE_ANON_KEY` are in the env. | config.js |
| **D8** | **565 files under `node_modules/` are git-tracked** despite the `.gitignore` rule (committed before the rule; ignore rules don't apply to tracked paths). Half the repo's tracked file count. `git rm -r --cached node_modules` when convenient. | .gitignore |
| **D9** | `save-engine.js` ctx drift: app.js still passes `pushSaveEvent` and `saveDebugLog` into ctx (`app.js:417`) but the engine has owned both since Stage 2 — dead entries. | app.js:417 |
| **D10** | Stale CI comment: `.github/workflows/ci.yml:31-35` still describes render-pixels as CI-ignored via `testIgnore`; `playwright.config.js` has `testIgnore: []` (linux baselines were committed and the ignore removed). Also `reuseExistingServer: true` is unconditional (usually `!process.env.CI`). | ci.yml |
| **D11** | Doc drift in ARCHITECTURE.md: (a) the Large-file map omits the 786-line bitmap-cache/tile region (Tier-1 #1); (b) no Files-table rows for `features/custom-icon-upload.js` and `features/line-color.js`; (c) header comments in `item-details.js` and `import-clear.js` still claim the custom-icon upload handler "stays in app.js". | ARCHITECTURE.md |
| **D12** | `my-counters/` filename defects ship verbatim into the icon picker: `cupling`, `reucing-t`, `sanatary-t` (×3), `washing-machiene`, `ro-spiket`, `mounted sink.svg` (literal space), `tankless-water-heater2`; ~20 of 48 SVGs are drafts/variants ("better", "nice", "dark"). | my-counters/ |
| **D13** | Brand-token triplication guarded only by a comment: `styles.css:1-24` ↔ `marketing.css:4-13` ("keep in sync") ↔ `manifest.webmanifest` theme colors. Candidate for a tiny `--check` script in the existing generator-check idiom. | styles.css et al. |
| **D14** | ~~FIXED 2026-07-30~~ — confirmed dead and deleted (markup, Plum cluster, upload-handler block, CSS rule; net −279 lines). | quick-modals.js |

Test-coverage gaps worth recording: no `save-project.spec.js` (its checkout-expiry preflight is
the riskiest untested logic in features/), no `view-only.spec.js`, no `custom-icon-upload` spec
(upload path untested), `share-links.spec.js` is 56 lines against 9 RPCs + an Edge Function +
destructive revoke/remove, `scale-zone-tool.spec.js` is an 11-line placeholder, and cloud
coverage overall is opt-in (6 of 7 cloud specs skip without `DEV_AUTH_*`; default `npm test`
proves nothing about save-to-cloud). In save-engine, the PDF-upload cluster and raw-REST
wrappers are the untested 24 of 78 API members — close that gap before extracting the upload
cluster. `drawLegend`/`drawGrid` in canvas-draw have zero coverage.

---

## 3. app.js (8,064 lines, 68 SECTION markers) — region map

Coupling = `state.` refs / DOM refs per region.

| Lines | Region | Span | Coupling | Verdict |
|------:|---|---:|---|---|
| 2–328 | Constants, icon pointers, State | 328 | 46 / 0 | leave (declaration surface) |
| 329–751 | [sync] heads: recovery, force reload, log, telemetry, dirty, undo stacks, checkout probe | ~420 | low | leave — thin wrappers over save-engine + undo model; greppability contract |
| **752–1384** | **Math & Format Helpers** | **633** | 98 / 34 | mixed: ~28 ln true delegates (done); **status-bar cluster 1134–1384 (~250) = candidate-now** (Tier-1 #3); canvas-caps probe (~62) + `hitTest` (95) = candidate-later pure modules |
| 1385–1392 | Coordinate Helpers | 8 | — | done |
| **1393–2178** | **PDF bitmap cache + Sharp crop tile + tile grid + warm-up** | **786** | 42 / 10 | **candidate-now, highest yield** (Tier-1 #1) |
| 2179–2854 | PDF Rendering | 676 | 139 / 8 | done (post canvas-draw); remainder is genuinely live-path |
| **2855–3848** | **UI Render Functions** | **994** | 291 / 267 | renderers (508 ln) = candidate-now (Tier-1 #2, #4); `updateUI`+`updateUIInner` (485) = leave (central chrome reconciler) |
| 3849–3962 | Inline rename & polyline edit | 114 | — | candidate-later (`startRename` moves with the sidebar-list extraction) |
| 3963–4302 | Modal primitives, toasts, airboard, RPC, telemetry, auth | 340 | — | leave |
| 4303–5966 | Modals & Handlers (30 sub-markers) | 1,664 | 314 / 569 | mostly done (deferred bindings to 44 feature files). Remaining fat: **Turn In 5348–5612 (265) = candidate-now** (Tier-1 #5); Canvas Repair wiring (153); Line color & sidebar handlers (142, pairs with Tier-1 #2); toolbar/tool-sidebar buttons (~243) |
| 5967–6356 | Canvas Event Handlers | 390 | 192 / 36 | leave (input layer) |
| 6367–6505 | Aim loupe | 139 | 39 / 0 | candidate-later — the one cleanly severable input piece (all state on `state.*`) |
| 6506–6584 | Zoom transform preview & commit | 79 | — | leave |
| 6585–7245 | Canvas mouse/wheel/touch | 661 | 445 / 14 | leave — "extract last, if ever" confirmed; drag state is on `state.*` but ~30 private callees aren't on the registry; seam if ever attempted = `createInputController(ctx)` seam module, not a feature file |
| 7246–7505 | Dropdown dismissal & hotkeys | 260 | 97 / 129 | leave (data-driven off `HOTKEYS`) |
| 7506–7669 | [sync] saves, local backup, keep-alive | 164 | — | leave (timers/listeners must stay app-side) |
| 7670–7886 | App feature registry (157 publishes) | 217 | — | leave (cost of decomposition, not a target) |
| 7887–8064 | View-only pointer, Init/boot | 178 | — | leave |

---

## 4. save-engine.js (2,916 lines) — verdict: do not split further

- ctx contract: **35 keys read** (37 passed — 2 dead, Defects §D9). Distribution is skewed:
  `getState` alone is 205 of ~390 ctx reads; it's one state handle + one client handle + a
  long tail, not 35 independent deps.
- Public API: 77 entries; app.js binds 81 wrappers. 44 node tests (24 exports untested — see
  coverage gaps above).
- Regions (banner comments are accurate): log core (56) · dirty core (40) · checkout
  probe/hash/backup (208) · client resilience (355) · checkout subscription (180) · expired
  recovery (255) · Turn In (249) · outcome/telemetry/envelope (360) · manual save (630,
  incl. `performSaveProjectToCloud` at 415 ln) · auto-save (298) · force reload (79) ·
  keep-alive (37).
- The call graph is hub-and-spoke around `performAutoSave` (Turn In, expiry recovery, forced
  turn-in all call it; it calls back into subscription + raw REST). Any split along region
  boundaries creates circular imports or a second ctx layer — net coupling goes **up**.
- If a split is ever mandated: (1) the PDF-upload cluster (1782–1932, ~150 ln — narrow
  interface, no reverse edges, currently untested; write its tests first), (2) `sha256Hex` →
  save-utils.js (10 ln). Everything else: negative value.
- Line count is concentrated in three functions (`performSaveProjectToCloud` 415 +
  `performAutoSave` 297 + `doTurnIn` 238 = 950). If the file feels unwieldy, do intra-function
  phase extraction, not module splitting.

---

## 5. Root modules

| File | Lines | Tests | Verdict |
|---|---:|---|---|
| `geometry.js` | 415 | 52 cases, all 33 exports | keep; move `formatAgo` → format.js (misfiled); sheet-classification block (~80 ln) is an optional future split |
| `constants.js` | 287 | 20 cases (incl. reflective sweeps) | **decompose** — Tier-2 #7 |
| `idb.js` | 446 | 11 cases | keep as one module (`openPdfCacheDb` singleton binds all 10 stores); dedupe the ~15-line LRU-eviction copy (pdfCachePut vs idbTakeoffBackupPut); fix header (D5) |
| `format.js` | 162 | 14 cases, all 9 exports | keep; route the private `esc` through `escapeHtml` (D4); natural landing spot for `formatAgo` |
| `save-utils.js` | 153 | 18 cases, all 10 exports | keep — exemplary (the `opts`-injection pattern in `pdfUploadTimeoutMs` is the model) |
| `line-metrics.js` | 124 | 11 cases, all 8 exports | keep — reference-quality extraction; deepen drop-unit test coverage |
| `icon-render.js` | 75 | 9 cases, all 7 exports | keep; **hard load-order constraint**: `CUSTOM_ICON_META` evaluated at parse time, silent failure if icons.js doesn't precede it |
| `canvas-draw.js` | 766 | 10 cases (drawLegend/drawGrid uncovered) | defer split; if it passes ~1,000 ln cut `drawLegend` (165) first, then `drawGrid` (47); hoist the two near-identical `drawPerpTick` closures now |
| `render-service.js` | 313 | 6 cases | do not split — one public entry, mutually-recursive worker-pool state; `ensureDocHash` is the only outlier and needs the same guarded transport read |
| `render-worker.js` | 143 | spec-covered | do not split (worker entry point; `importScripts` would add a failure mode). Latent risk: the `getDocument` options here and in `App.getPdfDocument` are two copies of one contract — share the constants |
| `annotation-model.js` | 614 | 27 cases | **split** — Tier-2 #6 (undo stack out) |
| `report.js` | 513 | 7 cases (2 exports only; 98% of module unreachable from Node) | **refactor internally** — Tier-2 #8; file split stays "leave" (frozen `window.*` contract: 6 outbound names, `{pageIndices, getAnnotations}` options shape, return types used as booleans, load-position-last) |
| `icons.js` | 531 | — | leave — data file (252 path consts + 249-entry ICONS index); only ever read via search |
| `icons-custom.js` | 259 (generated) | — | n-a — regenerate via `npm run build:icons`; never hand-edit |

Cross-cutting constraints any root-module split must respect:
1. `eslint.config.js` derives per-group lint globals from each module's CommonJS export footer —
   new files must be added to the right groups or `no-undef` fires.
2. Script load order in `app/index.html:38-50` encodes real dependencies; two are
   parse-time-critical (icons → icon-render; constants before load-time store-name reads).
3. `scripts/build-macros.js` reads `HOTKEYS` from constants.js (CI-checked) — moving it is a
   same-commit change to that script.
4. Every shell file added/renamed = HTML tag + `PRECACHE_URLS` in sw.js + `npm run build:sw`.

---

## 6. features/ — all 44 files

| File | Lines | Verdict | Note |
|---|---:|---|---|
| burger-menu.js | 170 | leave | lowest coupling in the set; rows derived from live DOM |
| canvas-layers.js | 241 | leave | single data structure (`page.canvases`) lifecycle |
| canvas-repair.js | 99 | leave | registry pilot; destructive whole-project mutation, keep isolated |
| choose-create-line-type.js | 115 | leave | shares the 10×-duplicated "collapse Pages section" block (add `App.collapsePagesSection()`) |
| counter-settings.js | 154 | leave | mechanical slider repetition; data-driven table optional |
| counter.js | 187 | leave | builds the icon grid inline 3× — feeds the `renderIconGrid` dedupe (Tier-3 #13) |
| custom-icon-upload.js | 173 | **act** | Tier-3 #13: mine the pure SVG parser; collapse 4 duplicated grid blocks; no spec; no ARCHITECTURE row (D11) |
| export-pdfs.js | 341 | leave & watch | split seam = the jsPDF pipeline (`downloadSpecificPages` ~110); dedupe the two `setAll*` twins + the repeated render-page block now; revisit at ~450 |
| grid.js | 166 | leave | origin-pick handoff rides `state.gridOriginPickMode` (no callback needed) |
| groups.js | 186 | leave | dedupe `openGroupAssignModal` vs `refreshGroupAssignButtons` (~30 ln); receive `deleteGroup` from item-details |
| import-clear.js | 110 | leave | weakest cohesion pairing but both halves too small to split |
| item-details.js | 392 | leave & watch | Tier-3 #15: move `deleteGroup` → groups.js now; details/line-properties split clean but optional (revisit ~500) |
| keyboard-map.js | 278 | leave | half is layout data; lit keys derived from the Macros table (cannot drift) |
| legend-settings.js | 128 | leave | dedupe the 8×-verbatim `legendSettings` default literal |
| line-color.js | 117 | leave | shared service of 4 features — do not merge into any one of them; no ARCHITECTURE row (D11) |
| line-type-settings.js | 161 | leave | textbook single-modal file |
| lines-list.js | 163 | leave | **the seam exemplar** — cite for Tier-1 #2 |
| load-project.js | 969 | split-candidate (watch) | Tier-3 #14: cut at documented L653/655; internal `renderLoadProjectListRows` decomposition first |
| manage-icons.js | 185 | leave | nested-closure style correct at this size |
| manage-projects.js | 161 | leave | `formatSizeMb` duplicated with load-project (5 ln — not worth a publish) |
| multiply-zone-settings.js | 77 | leave | smallest; borderline merge-candidate but the settings/apply seam is clean |
| my-settings.js | 153 | leave | settings hub; watch the Artboard cluster (~60 ln) if it grows; note split binding ownership (`#mySettingsMyActivity` bound by user-admin.js) |
| note.js | 93 | leave | one of the cleanest splits |
| output.js | 416 | split-candidate (low) | Tier-3 #16; the shared PDF helpers at its tail are what broke prepare-pdf (D1) |
| page-settings.js | 80 | leave | honest home for the `#pagesSectionTitle` opener |
| pdf-bundle.js | 235 | leave | the one *library* file (5 exports, no UI); convert its load-time destructure to call-time (D1 family) |
| pdf-intake.js | 357 | internal-extract first | Tier-3 #17: 82% is one anonymous 290-line handler; spec is `pdf-upload.spec.js` (name-align) |
| prepare-pdf.js | 392 | leave (fix D1) | 9 module `let`s form a genuinely shared working set; extract `commitPreparePdfToState` (~120) internally |
| quick-keys.js | 247 | leave | **the internal-structure exemplar** — 11 small named functions, documented single-selection-path invariant |
| quick-line.js | 134 | leave | sibling of choose-create-line-type (only plausible merge pair; tab boundary defensible) |
| quick-modals.js | 462 | **dedupe-first** | Tier-3 #9: likely-dead `#plumModal` (D14); ~200 duplicated lines; load-time destructure violation |
| restore-last-session.js | 238 | leave | widest `App.*` surface (32) — symptom of "rehydration touches everything"; hydration dedupe = Tier-3 #12 |
| room-sizer.js | 443 | leave | best-organized large file; optional future: lift `getRoomVolumeTotals` (~45, pure-ish) for node tests |
| save-project.js | 206 | leave (test caveat) | no spec; the checkout-expiry preflight (117–163) is the riskiest untested logic in features/ — name it as `preflightCheckoutExpiry()` and spec it |
| save-status.js | 181 | leave | **the pattern reference** for getter-accessors + narrow read-only deps |
| scale.js | 412 | leave | verify flow (~90) is the cut if it passes ~500; factor the 5×-repeated tool/mode reset now |
| share-links.js | 238 | leave (coverage flag) | 56-line spec vs 9 RPCs + Edge Function + destructive actions — weakest test-to-risk ratio |
| summary-detail.js | 113 | leave | note: sequential thumbnail renders, no cancel on modal close (perf item) |
| user-activity.js | 459 | split-candidate | Tier-3 #11 |
| user-admin.js | 453 | dedupe-first | Tier-3 #10 |
| view-only.js | 326 | split-candidate (either way) | Tier-3 #12 is the priority; `viewer-scale.js` split (~120/~200) defensible |
| zone-modals.js | 104 | leave | the "no registration, state-flag-mediated" template |
| zoom-rail.js | 228 | leave | note: owns two unconditional document-level listeners (global-listener registry candidate) |
| zoom.js | 49 | leave (weak merge-candidate) | merge into zoom-rail only if the rail is ever rewritten |

Total features/: **10,592 lines** across 44 files.

---

## 7. Presentation layer

| File | Lines | Verdict |
|---|---:|---|
| `app/index.html` | 2,468 | **leave** — 70 modals = 78% of the file; they cluster cleanly onto existing feature-file owners, but partials are blocked by: no build step, load-time DOM binding in every feature file, the SW single-document offline fallback, and the build-macros marker splice. Revisit only if a build step arrives for another reason. One generated region (Macros table, L1256–1284). |
| `index.html` (root) | 217 | leave — marketing landing; owns public SEO; the L5–23 inline script forwards legacy `?t=`/`?devAuth=1` links and unregisters stale root-scoped SWs |
| `styles.css` | 1,368 | leave — splitting is net-negative (N render-blocking `<link>`s, PRECACHE churn, `:root` token ordering, cascade-order risk with no CSS visual guard). **Recommended alternative: comment-only region banners at the ~20 mapped boundaries** + normalize the unindented tail (L1184+, the post-extraction appends). |
| `marketing.css` | 136 | leave — already sectioned; the `:root` token mirror (L4) is D13 |
| `sw.js` | 197 | leave — format-mandated single file; `CACHE_VERSION` generated (never hand-edit); `PRECACHE_URLS` (93 entries) hand-maintained, superset-verified by build-sw |
| `manifest.webmanifest` | 17 | leave — third copy of brand tokens (D13) |
| `guides/` tree | 23 files | generated (`npm run build:guides`); treat exactly like icons-custom.js |

---

## 8. Tooling

| File | Lines | Verdict |
|---|---:|---|
| scripts/build-toc.js | 73 | leave; donor for `lib/markers.js` |
| scripts/build-filemap.js | 84 | leave (third region-finding strategy: heading-bounded; day-stable caption by design) |
| scripts/build-macros.js | 85 | leave; shares byte-identical icon regex with build-guides → `lib/app-icons.js` |
| scripts/build-guides.js | 293 | split-candidate (Tier-4 #21) — a real SSG; its Map-diff `--check` is the form to standardize on |
| scripts/build-sw.js | 128 | leave whole (hash stamp + shell-coverage gate share the parsed list; header comments are institutional knowledge) |
| scripts/build-custom-icons.js | 133 | leave (only script with a CLI-flag surface) |
| scripts/build-pwa-icons.js | 69 | leave; canonical home of the triplicated reticle glyph |
| scripts/build-og-image.js | 92 | leave |
| scripts/build-sample-plan.js | 133 | leave (~60% coordinate data) |
| scripts/build-screenshots.js | 334 | split-candidate (Tier-4 #21) — isolate the app-internals-coupled fixtures (the only script that pokes private app state) |
| scripts/generate-config.js | 33 | leave; add a refuse-to-overwrite-tracked-file guard (D7) |
| eslint.config.js | 429 | refactor (Tier-4 #19): keep Half A (derived globals — the design is right) and the comments; collapse Half B's 8 identical blocks |
| playwright.config.js | 34 | leave; fix `reuseExistingServer` for CI (D10) |
| package.json | 38 | leave; `check` chain → check runner (Tier-4 #22) |
| .github/workflows/ci.yml | 57 | leave; fix stale comments (D10) |
| cloud-test-helpers.js | 93 | minor: extract `createSeedProject(page)` so auth-only specs skip the 30s save wait |
| run-migrations.sh / deploy-admin-functions.sh | 10 / 13 | leave; note deploy list can drift from `supabase/functions/` and `--no-verify-jwt` lives only here |

---

## 9. supabase/

- **9 Edge Functions + 2 `_shared/`, 550 lines TS total.** Verdicts: `reassignProjects.ts`
  (79 ln) is the model `_shared/` extraction — the ordering contract (storage move before DB
  row, throw-to-abort so a user is never deleted on partial failure) is documented and
  load-bearing. Seven functions copy-paste the same admin-auth prologue (~8 ln each) and
  `admin-list-users` has already drifted from it (different 401 message, `.trim()`, surfaces
  authErr) — the drift is the argument for `adminGuard.ts` (Tier-4 #20). `invite-to-project`
  needs the user-check half only (design the guard as `requireUser` + separate
  `requireAdmin`). `get-view-project` (135) and `set-view-scale` (127) share byte-identical
  domain-gate helpers; set-view-scale's `jsonRes` should be promoted. Storage-failure
  semantics are inconsistent (reassign = fatal; admin-delete-project = fire-and-forget).
  Silent caps to note: `admin-list-users` `perPage: 100`; `invite-to-project` linear scan
  over `listUsers({perPage: 1000})` to resolve an email.
- **Migrations: 54 files** (timestamped; earlier docs/agents citing 66 were counting stale
  info — verified by directory listing). Append-only by the SUPABASE_SETUP.md 1:1
  version-tracking contract and by consistent practice (corrections are always new files —
  034 reverts 032/033, `storage_shared_read_fix` patches 012, `…221000` completes `…220000`).
  **Out of scope for decomposition.** Note: the literal phrase "append-only" appears nowhere
  in the docs; if the rule is to be cited, quote SUPABASE_SETUP.md's contract or add the
  sentence explicitly.
- `config.toml`: see D3.

---

## 10. Tests

- **13 `*.test.js`** (3,182 lines, 214 cases, `node --test`). Full-surface coverage:
  geometry, save-utils, format, line-metrics, icon-render, constants (reflective sweeps
  auto-cover new exports). Partial: annotation-model (accessor wrappers +
  `projectHasAnyCanvasMarkup` untested), canvas-draw (`drawLegend`/`drawGrid` zero),
  idb (`openPdfCacheDb` upgrade path), render-service (worker success path,
  `ensureDocHash`). Weak: save-engine (24 of 78 members — raw-REST, snapshot writers,
  reload execution), report (2-symbol export; everything else IIFE-locked).
  Testability pattern to reuse: `Object.assign(globalThis, require('./constants.js'))`
  before requiring the module under test.
- **79 `*.spec.js`** (9,006 lines, serial: `workers: 1`). 38 of 44 feature files have a
  name-matched spec; the 6 without are burger-menu, custom-icon-upload, line-color,
  pdf-intake, save-project, view-only (coverage severity ranked in §2). 41 specs explicitly
  reference their `features/*.js` file — the decomposition ledger. Three specs pin `App.*`
  surface that has NOT been extracted yet (`pdf-upload`, `page-switch-cache`,
  `zoom-no-updateui-during-gesture`) — treat as extraction candidates' ready-made nets.
  Nine size outliers (quick-keys 324 … keyboard-map 209) are 25% of the suite.

---

## 11. Everything else (catalogue)

- **Docs**: AGENTS.md (405 ln) · ARCHITECTURE.md (1,269 ln; two generated blocks) ·
  CHANGELOG.md (2,249 ln) · RECONSTITUTE.md (173 ln) · SUPABASE_SETUP.md (265 ln) ·
  CUSTOM_ICONS.md (43 ln). content/guides/: 11 articles + authoring README.
- **`my-counters/`**: 48 SVG sources → icons-custom.js. Naming defects = D12.
- **`vendor/`**: 209 files, ~5.4 MB + cmaps/fonts — version-pinned, catalogue only.
  Largest: pdf.worker (1.09 MB), pdf-lib (525 KB), jspdf (364 KB), pdf.js (320 KB).
- **`icons/`**: 5 generated PWA icons. **`img/`**: landing-hero.png (249 KB).
  **`samples/`**: sample-plan.pdf (generated). **`render-pixels.spec.js-snapshots/`**:
  6 baselines (3 scenarios × darwin/linux; both platforms active — the spec runs in CI).
- **Fixtures**: test-page.pdf, test-2pages.pdf. **SEO**: og-image.png (generated),
  robots.txt, sitemap.xml (generated by build-guides). CNAME. `.vscode/settings.json`
  (Live Server port 5502 — differs from Playwright's 3456).
- Completeness: per-directory tracked counts sum exactly to `git ls-files` = 1,130;
  nothing unaccounted for.

---

## 12. Suggested sequencing (when we decide to act)

1. **Bug fixes first** (D1 prepare-pdf TypeError; D2 report.js via the `collectSummaries`
   refactor; D3 config.toml decision) — each independently shippable.
2. **Hygiene batch**: D4–D6, D9–D11 comment/header/doc fixes + the two load-time
   destructures (pdf-bundle, quick-modals); confirm-and-delete `#plumModal` (D14).
3. **Tier-1 #1** (pdf-tile-cache seam module), staged: cache → pyramid/rungs →
   prefetch/warm-up → crop tile/tile grid, each stage behind the nine existing specs.
4. **Tier-1 #2–#4** (renderers + status bar), one feature file per PR, lines-list recipe.
5. **Tier-2** root-module splits (undo-stack, constants) — small, mechanical, well-tested.
6. **Tier-3 dedupes** opportunistically as those files are touched.
7. **Tier-4 tooling/cloud** whenever a generator or Edge Function is next edited.

Every extraction: follow the established recipes (seam-module `create*(ctx)` for
load-time-wired code, feature-file registry for user-action code), ship with a spec,
update the eslint group, the `<script>` tag, `PRECACHE_URLS` + `npm run build:sw`, and the
ARCHITECTURE.md Files table + Large-file map (`npm run build:filemap`).

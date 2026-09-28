# Decomposition Map

<!-- project-map-head: 3eb45a9c51744fd5de3cd317114f5d8a51337759 -->

Read at `3eb45a9`, 2026-09-27. **Where to decompose next, and what is broken on the way there.** This replaces the 2026-09-25 map, whose 25 ranked items all landed by 2026-09-26 (its text is in git: `git show 500de2a:DECOMPOSITION_MAP.md`).

## How this map was made, and how to refresh it

1. **Measured, not read.** `npm run build:projectmap` writes `project-map/` (gitignored) in a few seconds: file sizes and load order, the `window.App` registry graph, state reads and writes, DOM ids by owning modal, every function of 20+ lines, the specs that pin each file, near-duplicate blocks, and churn since this map's head (the marker above).
2. **Judged in shards.** Eight agents, one per area of section 7, each read the old map's section for its area, the skeleton and the code, and answered three questions: what is still open, what is new, what to leave alone.
3. **Checked by the same hand.** Unlike the September 25 run there was no separate skeptic pass. Each agent was told to try to refute its own findings and to list what it dropped. Two defects were then re-run by the orchestrator (the water tap rule, in node; the four unescaped values, by reading). Everything else marked "read" below was read in code and not executed.

Cost: 8 agents, about 2.6M subagent tokens, 728 tool calls, 13 minutes each in parallel. Half the September 25 run, which paid for its skeptics.

## 0. What changed since the last map

| | At `37cc51d` | Now |
|---|---:|---:|
| `app.js` | 8,588 | 7,079 |
| `features/*.js` | 97 files, 31,792 lines | 103 files, 34,335 lines |
| `save-engine.js` | 3,103 | 3,261 |
| `duct-model.js` | 2,355 | 2,642 |
| `features/tutorial.js` | 1,656 | 1,989 |
| `features/lessons.js` | 809 | 1,149 |
| `canvas-draw.js` | 1,930 | 1,410 (+ `canvas-legend.js` 674) |
| Specs | 35,380 lines | 39,567 lines, 189 files |

The ranked list worked: `updateUIInner` went from 592 lines to 314, the keydown handler to 141, the touch copy of the click handler is gone, and every refactor the agents checked holds in the code. What grew is the teaching layer (Start here, the Words search, the tap targets, the card clamp), the duct air layer (`duct-model.js` §3c, 318 to 506 lines) and the save engine (Stage 7, the lean permissions read, R1-WINDOW). Two large functions were never touched: `renderAnnotationsInner` (392 lines, about 290 of them copied live previews) and `hitTest` (154 lines, no node test).

## 1. Ranked shortlist

Defects first, then what makes later moves cheap, then the moves. Yield is lines removed or moved out of a larger file, as the agents estimated it.

| # | Item | Risk | Yield |
|---:|---|---|---:|
| S01 | [Water tap rule: siblings off one point](#s01-water-tap-rule-siblings-off-one-point) | low | ~5 |
| S02 | [Escape colour and icon values on four surfaces](#s02-escape-colour-and-icon-values-on-four-surfaces) | low | ~0 |
| S03 | [CI reaches a verdict on main](#s03-ci-reaches-a-verdict-on-main) | low | 0 |
| S04 | [Specs run from a worktree](#s04-specs-run-from-a-worktree) | low | ~20 |
| S05 | [One bundle builder, and the bundle buttons leave app.js](#s05-one-bundle-builder-and-the-bundle-buttons-leave-appjs) | low | ~50 |
| S06 | [Esc closes the painted top; dialogs stack by open order](#s06-esc-closes-the-painted-top-dialogs-stack-by-open-order) | medium | ~30 |
| S07 | [A tour that starts stops the one running](#s07-a-tour-that-starts-stops-the-one-running) | low | ~2 |
| S08 | [One mark-presence predicate](#s08-one-mark-presence-predicate) | low | ~15 |
| S09 | [One duct system rule, then a way to set a run's system](#s09-one-duct-system-rule-then-a-way-to-set-a-runs-system) | medium | ~10 |
| S10 | [One trade resolver](#s10-one-trade-resolver) | medium | ~5 |
| S11 | [Spec-copy ratchet, then the spec-helpers migration](#s11-spec-copy-ratchet-then-the-spec-helpers-migration) | low | ~600 |
| S12 | [Shared step reader and teaching-file finder for the tooling](#s12-shared-step-reader-and-teaching-file-finder-for-the-tooling) | low | ~55 |
| S13 | [tour-geometry.js, with placeCard](#s13-tour-geometryjs-with-placecard) | low to medium | ~150 |
| S14 | [Duct schedule core and its text builders into the model](#s14-duct-schedule-core-and-its-text-builders-into-the-model) | medium | ~195 |
| S15 | [One tool-input table and a rect-click helper](#s15-one-tool-input-table-and-a-rect-click-helper) | medium to low | ~65 |
| S16 | [Copy surfaces in output.js, table-driven](#s16-copy-surfaces-in-outputjs-table-driven) | low to medium | ~85 |
| S17 | [Save-engine dedupe, round 2](#s17-save-engine-dedupe-round-2) | low to medium | ~65 |
| S18 | [app.js leftovers to the files that own them](#s18-appjs-leftovers-to-the-files-that-own-them) | low | ~260 |
| S19 | [Checkout recovery into turn-in.js](#s19-checkout-recovery-into-turn-injs) | medium | ~190 |
| S20 | [Project open into its own file](#s20-project-open-into-its-own-file) | low | ~215 |
| S21 | [One teaching device snapshot, then Learn's machinery out of lessons.js](#s21-one-teaching-device-snapshot-then-learns-machinery-out-of-lessonsjs) | medium | ~425 |
| S22 | [The trade tours out of the engine](#s22-the-trade-tours-out-of-the-engine) | medium | ~770 |
| S23 | [The duct air layer into duct-air-model.js](#s23-the-duct-air-layer-into-duct-air-modeljs) | medium | ~1,180 |
| S24 | [Bid Check: gate core into the model, one contributor list](#s24-bid-check-gate-core-into-the-model-one-contributor-list) | medium | ~105 |
| S25 | [Node tests for report.js's text and payload builders](#s25-node-tests-for-reportjss-text-and-payload-builders) | low | 0 |
| S26 | [Small dedupes and the doc sweep](#s26-small-dedupes-and-the-doc-sweep) | low | ~450 |

**Not on the list, on purpose: the gesture core.** The mouse, wheel and touch handlers in `app.js` are about 1,195 lines. The old map said to extract them last, after the resets and the Esc table, and both have landed. It is still not time. S15 has to land first, or the move carries six hand-kept tool lists into a new file. Wheel and pinch share closure variables with `renderPdf` (`lastRenderedZoom`, `wheelZoomCommitTimer`, `wheelZoomLastEventTs`, `zoomGestureDirection`) and stay where they are in any move. And no spec drives a touch pinch, a one-finger or middle-button pan, a long-press on a mark in Move, the note grips, a legend drag, or a double-click finishing a run. With those pinned the move is mechanical, about 900 lines into `features/canvas-input.js`, at medium to high risk. Do it only if the input sections keep churning after S15.

### S01. Water tap rule: siblings off one point

`water-model.js` `waterChildLinks` (396-410). Two same-side water runs that leave one point each have their first vertex on the other, so each becomes the other's child, and `waterDownstreamByRun` gives each run both loads. Reproduced in node at `3eb45a9`: two cold runs from (0,0) return two links, a cycle, where `ductChildLinks` returns none. The duct twin got its guard on 2026-09-27 (DS-DINING-ATTACH, `ductTapParentOf`, duct-model.js:1247); the water copy did not. **Effect:** pipe sized for twice the fixture units. **Fix:** skip a candidate parent whose own first vertex sits within snap of the child's. **Pin:** a node case in water-model.test.js, then water-size.spec.js and water-schedule.spec.js.

### S02. Escape colour and icon values on four surfaces

A colour or an icon path from a shared or imported project is concatenated raw into an attribute inside `innerHTML`: `features/sidebar-lists.js:268` (`g.color`), `features/lines-list.js:121` (a line's colour), `features/counter.js:85` (`c.color` and `c.icon` in the Counter chooser), `features/room-sizer.js:142` (`r.color`, `r.id`). Read in code, not executed. MAP-XSS (2026-09-26) fixed nine surfaces and these four are not among them; its spec draws no lines and opens no chooser. **Fix:** the escape MAP-XSS used, on each. **Pin:** extend the MAP-XSS spec to these four.

### S03. CI reaches a verdict on main

`.github/workflows/ci.yml:15-16`: `cancel-in-progress: true` also cancels pushes to main, and every push to main shares one group. On 2026-09-27, twenty main runs in a row were cancelled; the e2e job takes 42 to 49 minutes on two workers. **Recipe:** `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`; give e2e a four-way `--shard` matrix with `fail-fast: false` and a per-shard artifact name; set CI `retries: 1` (at 2, a failing 180 s course chapter runs three times). The repo is public, so each shard is its own runner: expect 12 to 15 minutes, with `tutorial.spec.js` (558 s) as the floor. Must not break: the separate `check` job, `regen-baselines.yml`, the `config.local.js` stub step in every shard. Rejected: a pull-request smoke set (a hand-kept list that drifts).

### S04. Specs run from a worktree

`playwright.config.js:17` `testIgnore: ['**/.claude/**']` matches a worktree's own absolute path, so specs cannot run inside `.claude/worktrees/` without a hand-written config; 23 were written on 2026-09-27. **Recipe:** anchor the ignore to the config's own directory with a RegExp (`new RegExp('^' + escapeRe(path.join(__dirname, '.claude') + path.sep))`; a glob cannot do it, Playwright prefixes `**/`), and read the port from `PW_PORT` into `baseURL` and the web server. Delete `playwright.session.config.js` and `playwright.worktree.config.js`, which were committed by accident (c36f435) and are headed "Temporary (untracked)".

### S05. One bundle builder, and the bundle buttons leave app.js

**Landed 2026-09-27 (BUNDLE-ONE-SHEET).** All three defects reproduced in pdf-bundle.spec.js before the fix; the bundles now collect from every layer.

`features/pdf-bundle.js` 264-371 (notes) and 373-448 (highlights) repeat item collection, the summary table and the crop; `app.js` 4274-4313 still wires both buttons as twins. Three defects ride here, all read in code: with exactly one sheet exported, the report off and bundles on, `getNumberOfPages() > 1` is false and the summary table prints on top of the sheet (pdf-bundle.js:292, 393); the bundles collect from the active layer only while the has-any check reads every layer, so items on another layer open a blank page (272, 381); the highlights table has no page-overflow guard (402-407). **Recipe:** `collectBundleItems`, `cropSheetJpeg`, `addBundleSummary`; both builders take `doc = null` and make their own A4, which removes the page-count guess. **Pin first:** a one-sheet Export PDFs spec with bundles on (it fails today).

### S06. Esc closes the painted top; dialogs stack by open order

`features/esc-ladder.js:222-227` walks `MODAL_RUNGS` in list order when the top overlay has a rung, so with the Line colour picker open over its parent, Esc closes the parent and leaves the picker up. `showModal` (app.js:3159) gives a second dialog no z above the first, so the Custom Icons tips dialog opens behind the details dialog (both z 200). Read, not run. **Recipe:** `showModal` raises a new overlay's inline z above the highest visible one and `hideModal` restores it, so painted order is opened order; `handleEscape` then dismisses the top, and the 36 plain-hide rungs go. **Pin:** two new cases in esc-ladder.spec.js.

### S07. A tour that starts stops the one running

`features/tutorial.js:1735-1755` `startTutorial` never stops a running tour, so the replaced tour's `onStop` never runs. The doors are reachable mid-tour (the overlay is `pointer-events:none`). A lesson's device settings (Snap, the sidebar filter) stay changed until the next load, and the blank tour's palette sweep is skipped. **Fix:** `if (active) stopTutorial(false)` at the top. **Pin:** mid-lesson with Snap changed, start a tour from Learn, check Snap is back.

### S08. One mark-presence predicate

Three hand lists of what counts as a mark have drifted: `annotation-model.js:286-291`, `app.js:3153-3158`, `features/pdf-intake.js:283-291`. The last lacks `ductRuns`, so a signed-out HVAC backup holding only duct runs is never re-applied when the same PDF is uploaded again (D30). **Pin:** an annotation-model.test.js case that walks `makeAnnotations()` keys and fails on a kind no list classifies. **Built 2026-09-27 (REAPPLY-DUCT):** `ANNOTATION_KINDS` in annotation-model.js is the one table; see the CHANGELOG. `bid-basis-model.js pageHasBidMarks` and `features/export-pdfs.js countPageMarks` still keep their own take-off-only list.

### S09. One duct system rule, then a way to set a run's system

This is the code side of punch row DUCT-RUN-SYSTEM. A run's system is decided by one line, `features/duct-tool.js:208` (`systemGroupId: state.activeGroupId || null`), and nothing can change it afterwards: the run menu has no System, and Assign to Group excludes duct runs. The first-run toast (duct-tool.js:411) tells the estimator to assign it in Groups, which no surface can do. Under that sits a confirmed disagreement in the model: `ductSystemDesignedCfm` (duct-model.js:1655) keys a tree by its root's system, while `tallyFlexDrops` and `ductDraftRemainingCfm` key by each run's own. A branch traced with no group lit but tapped off an RTU main counts in the main's designed CFM while its flex files under "No system". **Order:** unify the two rules first; then the product call; then either a pure `ductRunSystemForStart` in the model, run at vertex 1 in `commitDuctClick`, or a System segment in the run menu modelled on `setRunAirside`.

### S10. One trade resolver

D42, wider than mapped. Ten sites read the raw `state.trade` (bid-check.js:150, 167, 181, 276; conductors.js:45, 64; circuits.js:39; tag-reader.js:63, 332; room-sizer.js:203; canvas-legend.js:243), others read `getQuickTrade()` (the project's trade, else the device default, else plumbing), and header-more.js has a third, `statedTrade()`. On a project that never named a trade, Bid Check shows water rows and the IPC edition but no hanger, fitting or plumbing manual rows. **Needs a product call first:** does the device's default trade count as the project's? AGENTS.md says no trade means plumbing; two surfaces already treat the default as a choice.

### S11. Spec-copy ratchet, then the spec-helpers migration

R07 made `spec-helpers.js` and stopped at 25 of 189 specs. The suite carries 251 boot-wait copies, 184 upload copies and 224 console collectors, and two specs added on 2026-09-27 pasted all three again. 240 of the boot waits test `!window.App || …`, which is true when `app.js` never loaded. **Recipe:** first a node test that counts the three shapes and fails when a count rises above its ceiling; then migrate in batches and lower the ceilings. `pastStartHere` becomes `bootApp(page, { returning: true })`, since an init script has to precede the goto.

### S12. Shared step reader and teaching-file finder for the tooling

`scripts/score-courses.js:307-358` copies the AST text reader of `scripts/check-lesson-rules.js:57-108`; their `sentences` have already drifted. `check-lesson-rules.js:50-53` hand-lists six teaching files, so a new tour file would escape the rules check. `features/learn-taps.js:40-44` copies `termRe` by hand and nothing pins that the two agree. **Recipe:** `scripts/lib/step-source.js` with the reader and `teachingFiles()` (lifted from teaching-labels.test.js); a learn-taps.test.js case that compares the two regex sources. Do this before S22, which adds a teaching file.

### S13. tour-geometry.js, with placeCard

`features/tutorial.js` `render` is 188 lines; card placement is 1291-1389, with the four-corner list three times and the 2026-09-27 window clamp pasted into both branches. That clamp fixed a bug that only showed on CI's Linux. The zone math (144-191) and `measureProof` have no node test either. **Recipe:** write tour-geometry.test.js first (corner order, zones clear, a card taller than the corner allows); then a pure module with a CommonJS footer, the way learn-taps.js does it, holding `placeCard`, `markZones`, `pathZones`, `boxZone`, `panDelta`, `focusView`. The engine keeps the DOM reads.

### S14. Duct schedule core and its text builders into the model

`features/duct-schedule.js:126-258` `computeDuctSchedule` is the bid weight PipeTooling receives, and only Playwright reaches it. **Recipe:** a node golden test first (mixed classes, one zone, grease, flex over the cap, a damper per tap, counted against factor); then `ductScheduleFromPages` in duct-model.js, with the feature keeping the `App.*` reads. It replaces `rollupRunsToSchedule` (D41, test-only and misleading). The text builders beside it (453-526, 596-630) move with it, with a round-trip test into report.js's `summarizeToolingExport`.

### S15. One tool-input table and a rect-click helper

Tool knowledge is hand-listed in six places: `isAimingTool` (app.js:5313), `RECT_TOOL_START_KEY` (5306), the mousemove band gate (5757), the touchmove gate (6089), `clearToolStarts` (2897) and the Esc table's start keys. Two have drifted: desktop Measure's dashed band does not follow the mouse after the first point, and a finger drag with a Delete Area corner shows no band. **Recipe:** one `TOOL_INPUT` object keyed by tool, the lists derived from it, and `rectToolClick` for the six rect branches. This is the gesture core's precondition.

### S16. Copy surfaces in output.js, table-driven

Three dropdown openers (output.js:690-719, 738-762, 778-809), three option handlers and three option builders are one pattern written three times; two agents found it independently. **Recipe:** `openAnchoredMenu` and a `COPY_SURFACES` table bound by one `wireCopySurface`. Keep as config what differs on purpose: the two Tooling menus drop up and prefetch the view link, Copy Summary opens below when it fits. Do not split output.js until this lands.

### S17. Save-engine dedupe, round 2

Inside `save-engine.js`: the last-project pointer written three times, the update payload four, the with-PDF update twice, the manual raw insert twice, the rescue probe five, and a changed PDF hashed twice. One behaviour change rides along and should be named in the commit: the with-PDF manual save does not record a client failure through `noteSupabaseJsFailure` today (2325, 2337). Related: the manual Check Out (turn-in.js:83) has no timeout, so on a wedged client the buttons stay on "Checking out..." until a reload.

### S18. app.js leftovers to the files that own them

The canvas-only-needs-PDF dialog and the pdf-lib helpers (app.js:3665-3716, 4868-4888) to load-project.js and pdf-intake.js, about 60 lines. The auth chrome in `updateUIInner` (2756-2795) to bid-board.js, status-bar.js and project-settings.js, about 40. The My Settings folds and the load and copy cancels (4683-4706, 4780-4785), about 30. The live-preview helpers inside `renderAnnotationsInner` (crosshair four times, the scale-bar label twice, seven rubber rectangles), about 60. `App.armPlacing`, one arm path for the feature-file pickers, about 25: it also fixes a stale scale crosshair that stays on screen while counters are placed. A `TOOL_BUTTONS` table, about 50.

### S19. Checkout recovery into turn-in.js

`app.js` 4578-4641 and 4786-4867, inside the `if (SUPABASE_ENABLED)` block. No spec drives the recovery dialog. **Recipe:** the spec first; then the move, with `copyOrCreateViewLinkToClipboard` to share-links.js. It ends D20 (functions declared inside a block and reached from the registry).

### S20. Project open into its own file

`features/copy-project.js:54-134` and `features/load-project.js:416-557` hold the six functions every intake uses to open a cloud project; restore-last-session.js restates the only-copy rule inline. **Recipe:** `features/project-open.js`, the same App names. Fold in what remains of D28: bid-chip.js:211 and pdf-intake.js:177 still download every accessible project's whole takeoff to open one.

### S21. One teaching device snapshot, then Learn's machinery out of lessons.js

Two keys, two identical search writers (tutorial.js:1705, lessons.js:924) and two boot pollers. After that, about 60% of `lessons.js` is not lessons: the runner, the Learn menu, the palette tracking, Start here, the upload rule. **Recipe:** `features/learn.js` between tutorial.js and lessons.js, publishing `App.learnKit`; lessons.js keeps the sheets' geometry and `LESSONS`. This overturns the old map's verdict on the file, not on the content.

### S22. The trade tours out of the engine

`features/tutorial.js` 246-798 and 932-1161, about 770 of its 1,989 lines, are the three trade tours. **Before moving:** `registerTour` wires a tour's empty-canvas link; the trade resets move into each tour's `onStart`; `pushLineType` returns its id. Then `features/tour-trades.js` (a `tour-` name, so the teaching-file finder matches it). After S12.

### S23. The duct air layer into duct-air-model.js

About 1,180 lines: device attachment, downstream CFM, flex, room CFM, the ductulator, necks, the static path and the Bid Check rows. The cut is one-directional as long as the tap topology stays in core. Six of the thirty HVAC rule pointers move. **Before it:** a cross-script top-level-name collision check in `build:projectmap --check` (D40: `fmtIn` is a function declaration, so a later script's copy would silently replace it), and the three generic names prefixed. Nothing is broken today; do it when the next air feature lands.

### S24. Bid Check: gate core into the model, one contributor list

The gate's memory (`gateStatus`, `unresolvedRows`, `isAcknowledged`) is reachable only through Playwright; move it to bid-check-model.js with node tests, about 35 lines. Then one `CONTRIBUTORS` list in place of inline electrical and plumbing rows beside contributed duct and water rows, about 70 moved. Land after S10, since every contributor asks the trade.

### S25. Node tests for report.js's text and payload builders

`getPipeToolingSummary`, `getTakeoffToolingPayload` (the TakeoffTooling v2 contract) and `getEmailTextSummary` are pure over state and have no node test. No lines move; this is the pin under S14 and S16.

### S26. Small dedupes and the doc sweep

Each under 50 lines: legend-settings table-driven (11 dead guards, about 100 lines in all); the paired icon grid binder (7 copies, about 40); the zone-settings merge (about 60, optional); the item-details number fields (about 30); the groups assign fold (about 30); the Summary's flat branch (about 45); `zoomAboutPoint` and one minimum-zoom constant; the anchor-snap helper; Delete Page as a confirm dialog (one fewer modal); the profile-flags fetch (4 copies); dead code (`ductDistToSegment`, `App.learnWordsSearch`, `App.openBidCheckAtRow`, `App.applyEditBannerHold`); 16 dead CSS classes and 14 re-declared selectors. Then one doc sweep, last, so `build:toc` churns once: AGENTS.md and ARCHITECTURE.md still say `app.js` is about 8.6k lines, that `HOTKEYS` lives in constants.js (it is hotkeys.js), that render-pixels is ignored on CI; six SECTION markers are misnamed; eslint.config.js:336-345 exempts three names that no longer exist.

## 2. Defects

Confirmed means reproduced by running code. Read means read in code at `3eb45a9` and not executed. Bugs have PUNCHLIST rows.

| # | Severity | Check | Where | Defect |
|---:|---|---|---|---|
| N01 | bug | confirmed | `water-model.js:396` | Two water runs leaving one point each get both loads (S01). |
| N02 | bug | read | `features/sidebar-lists.js:268`, `lines-list.js:121`, `counter.js:85`, `room-sizer.js:142` | A colour or icon value is written into the page unescaped (S02). |
| N03 | bug | confirmed, fixed | `features/pdf-bundle.js:292, 393` | Export PDFs with one sheet prints the notes or highlights summary over the sheet (S05). |
| N04 | bug | read | `features/esc-ladder.js:223` | Esc closes the dialog under the colour picker, not the picker (S06). |
| N05 | bug | read | `app.js:4341` | The Custom Icons tips dialog opens behind the details dialog (S06). |
| N06 | bug | read | `.github/workflows/ci.yml:15` | Every push to main cancels main's run in progress (S03). |
| N07 | bug | read | `features/duct-tool.js:411` | The toast names an assignment no surface can make (S09). |
| N08 | bug, cosmetic | read | `app.js:5757` | Desktop Measure's band does not follow the mouse (S15). |
| N09 | latent | confirmed | `duct-model.js:1655` vs `1547`, `1409` | Two rules for which system a run belongs to (S09). |
| N10 | latent | confirmed, fixed | `features/pdf-bundle.js:272, 381` | Bundles read the active layer only; items elsewhere open a blank page (S05). |
| N11 | latent | read | `features/tutorial.js:1735` | Starting a tour never stops the one running (S07). |
| N12 | latent | read | `features/pdf-intake.js:283` | D30: a backup holding only duct runs is never re-applied (S08). |
| N13 | latent | read | `features/turn-in.js:83` | The manual Check Out has no timeout (S17). |
| N14 | latent | read | `features/bid-check.js:150` | A project with no trade gets an inconsistent Bid Check (S10). |
| N15 | latent | read | `features/choose-create-line-type.js:63`, `counter.js:88`, `quick-modals.js:403`, `tag-reader.js:287` | Feature-file arms skip `clearToolStarts`; a stale crosshair draws (S18). |
| N16 | latent | read | `project-settings.js:245` vs `save-engine.js:2926` | The two device-key lists differ (`stripPins`). |
| N17 | latent | read | `features/duct-tool.js:299` | The auto riser takes the first room box; the plenum check takes the smallest. |
| N18 | latent | read | `idb.js:143, 209` | D31: LRU eviction stops early, and evicts a neighbour on a re-put at the cap. |
| N19 | latent | read | `features/drop-mode.js:114` | D27: the Drop overlay is sized by the device pixel ratio. |
| N20 | latent | read | `render-worker.js:114` | D35: the worker's PDF options are a hand copy. |
| N21 | latent | read | `sw.js:480` | D36: a sample PDF regenerated alone goes stale inside a cache version. It did not bite on 2026-09-27: every sample change rode a restamp, by coincidence. View-link URLs with tokens are stored as cache keys. |
| N22 | latent | read | `duct-model.js:2031, 2313, 2347` | D40: generic top-level names in the shared scope (S23). |
| N23 | latent | read | `rules.test.js:32` | A course-only applied rule passes with no card naming it; 18 rules the cards do name lack `course`. |
| N24 | latent | read | `app.js:4483, 4522, 4618` | D20: block-declared functions reached from the registry (S19). |
| N25 | latent | read | `index.html:77-92, 682-693` | D45: the landing's hand copy of the site chrome drifted further. |
| N26 | latent, low | read | `features/tutorial.js:1174` | `escapeText` does not escape a double quote; reachable only from the reader's own counter name. |

Verified fixed since the last map: D01 to D19, D21 to D26, D29, D32 to D34, D37, D39, D43, D44.

## 3. Cross-cutting patterns

- **A fix lands on one copy of a twin.** The duct tap rule got its guard and the water copy did not (N01); MAP-XSS escaped nine surfaces and missed four (N02); MAP-RESETS made one reset list and the feature-file arms never call it (N15). After a fix, search for the twin.
- **Pure logic only Playwright can reach.** Card placement, the duct bid weight, the Bid Check gate, the report's payload builders, `hitTest`. Each is a node test waiting for a pure function (S13, S14, S24, S25).
- **Hand-kept lists that could be derived.** Tool input (S15), teaching files (S12), device keys (N16), the rulebook's `course` surface (N23), the eslint module lists.
- **A rule in AGENTS.md that nothing enforces gets broken the same week.** "Don't paste a copy of the boot wait" was broken twice on 2026-09-27. A counting test is the fix (S11).
- **The tooling re-implements itself.** Four copies of the static server, three boot variants, a copied AST kit.

## 4. Sequencing

- **0. Defects** (S01, S02, S05, S06, S07, S08): each with its spec or node test.
- **1. Make the rest cheap** (S03, S04, S11's ratchet, S12): CI that finishes and specs that run anywhere come before any large move.
- **2. Decisions** (S09, S10): two product calls, each blocking a build.
- **3. Pins** (S13's test, S14's golden test, S25): tests before the code they pin moves.
- **4. Dedupes** (S15, S16, S17, S18, S24, S26).
- **5. Moves** (S19, S20, S21, S22, S23): S21 before S22; the collision check before S23.
- **Last:** the doc sweep, then, if the input sections still churn, the gesture core.

## 5. Leave alone

- **app/index.html, styles.css**: single documents by necessity. Fold overrides and delete dead rules.
- **save-engine.js as one file**: one factory whose variables are shared engine-wide. Dedupe only.
- **annotation-model.js, idb.js, water-model.js, the trade pure models**: cohesive and node-tested.
- **canvas-draw.js, canvas-legend.js, pdf-bundle.js, the raster layer**: R24 and R25 landed days ago. Legend-face readiness is handled in one place.
- **report.js as one file**: it holds the `window.*` contract.
- **Lesson and course content** (`LESSONS`, the three `CHAPTERS` literals): content, not code. The file around `LESSONS` is another matter (S21).
- **tour-blank.js, learn-words.js, learn-taps.js**: cohesive; the last two are the model for S13.
- **The order of updateUI's guarded hooks**: load-bearing. Do not turn it into a listener array.
- **The keydown handler, the registry, the boot sequence, zoom and the aim loupe.**
- **features/bid-check.js, duct-tool.js, output.js, room-sizer.js as files**: dedupe inside them.
- **persona-driver.js `installHelpers`**: shipped into the page, so it stays one function.
- **The drivers' click and mark semantics**: films, persona and screenshots differ on purpose.

## 6. The skeleton's blind spots

Carried from the last map and still true: near-duplicates that differ by a renamed local; seam modules' `ctx.` and `deps.` coupling; big top-level literals; spec pinning by file name only. New this run:

- Load-time reads through an alias (`const K = () => App.lessonKit; K().registerCourse(…)`) are reported as not load-time, so `build:projectmap --check` cannot see the courses' script-order dependency (D38).
- Bare-name readers of pure modules are not measured, so a pure module's dead exports are invisible, and a split plan has to compute its consumers by hand.
- There is no cross-script top-level name table, which D40 needs.
- A name only tooling reads never enters the registry, so a renamed seam the drivers depend on is not flagged.
- It does not read eslint.config.js, so stale exemptions never appear.
- Tests that pin a fallback look like tests that pin the feature: about 20 permission tests walk the list fallback MAP-PERMS is to delete.
- Closure variables shared between functions are not shown; they decide how much of the gesture core can move.

## 7. By area

The agents' full reports, with every file:line, are not committed; the findings above are their substance. One line per area:

- **7.1 app.js render and UI**: `updateUIInner` halved. `renderAnnotationsInner` and `hitTest` untouched. S18, S19, S16.
- **7.2 app.js input, hotkeys, registry, boot**: clean registry, data-driven hotkeys. The gesture core waits on S15. S06.
- **7.3 Tours, Learn, courses**: 48 tours on one engine. The engine still carries three tours. S13, S21, S22, S07.
- **7.4 HVAC duct**: the model is sound and its growth is the air layer. S14, S23, S09.
- **7.5 Electrical, water, Bid Check, rulebook**: no split needed for size. S10, S24, S01.
- **7.6 Lifecycle, cloud, sharing**: sound. S17, S20, S08. R1-FLIP is laid out as a few-line change; MAP-PERMS's cleanup is mostly a test rewrite.
- **7.7 Drawing, rasters, report, output**: one raster pipeline, verified. S05, S16, S25.
- **7.8 Shell, CSS, tooling, specs**: barely moved. S03, S04, S11, S12.

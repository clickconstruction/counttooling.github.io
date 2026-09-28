# Decomposition Map

<!-- project-map-head: 65f712f3af41e6a90faf39a1c900f58c346c4906 -->

Read at `65f712f`, 2026-09-28. **Where to decompose next, and what is broken on the way there.** This replaces the 2026-09-27 map (read at `3eb45a9`; its text with the landed notes is in git: `git show 65f712f:DECOMPOSITION_MAP.md`), whose first eight items landed inside a day. What is new is a day of the teaching layer: the card review and the card pass grew the tour engine by 444 lines, and the map's open items in that area grew with it.

## How this map was made, and how to refresh it

1. **Measured, not read.** `npm run build:projectmap` writes `project-map/` (gitignored) in a few seconds: file sizes and load order, the `window.App` registry graph, state reads and writes, DOM ids by owning modal, every function of 20+ lines, the specs that pin each file, near-duplicate blocks, and churn since this map's head (the marker above).
2. **Judged in shards.** Eight agents, one per area of section 7, each read the old map's section for its area, the skeleton and the code, and answered three questions: what is still open, what is new, what to leave alone. Each was told to re-resolve every file:line the old map cited (they had all drifted in the churned files), to try to refute its own findings, and to list what it dropped.
3. **Checked by the orchestrator.** Four things were re-run here after the reports came in: the idb.js eviction (three shapes, node with fake-indexeddb), the duct system rule and the head-to-tail tap loop (node over duct-model.js), the water tap rule candidates against the plumbing tour's own geometry (node over a scratch copy of water-model.js), and the spec-copy counts (the greps in T11). Everything else marked "read" below was read in code and not executed.

Cost: 8 agents, about 1.6M subagent tokens, 266 tool calls, 7 to 14 minutes each in parallel. The three areas with no commits since the last map (duct, save engine, rasters) cost the least and still found two confirmed defects between them.

## 0. What changed since the last map

| | At `3eb45a9` | Now |
|---|---:|---:|
| `app.js` | 7,079 | 7,066 |
| `features/*.js` | 103 files, 34,335 lines | 103 files, 35,458 lines |
| `features/tutorial.js` | 1,989 | 2,433 |
| `features/lessons.js` | 1,149 | 1,283 |
| `features/quick-keys.js` | 263 | 415 (+ `quick-keys-model.js` 105, new) |
| `features/esc-ladder.js` | 244 | 199 |
| `save-engine.js`, `duct-model.js`, `canvas-draw.js` | 3,261 / 2,642 / 1,410 | unchanged, 0 commits |
| Specs | 39,567 lines, 189 files | 40,726 lines, 191 files |

Seven of the old map's 26 items landed (S02 to S08), all in the "defects first" tier, each with its pin. `app.js`'s input sections had zero changed lines. The growth is the tour engine: of `features/tutorial.js`'s +444, about 315 is engine (the chip renderer, `seen()` and the sticky-row rule, the form-target helpers, the sheet nudge and the glide) and about 129 is the three tours' cards. The card pass wrote one touch test into five course cards the day after the kit had exported it, and the XSS sweep's escaping put a dead chip on ten cards. Nothing in the save engine, the duct model or the raster layer moved, and re-reading them still turned up two confirmed defects (T02, T03) that the last map had carried as "read".

## 1. Ranked shortlist

Defects first, then what makes later moves cheap, then the decisions, the pins, the dedupes, the moves. Yield is lines removed or moved out of a larger file, as the agents estimated it at HEAD.

| # | Item | Risk | Yield |
|---:|---|---|---:|
| T01 | [The lesson spec waits for the sheet to stand still (FLAKE-START-UNDO)](#t01-the-lesson-spec-waits-for-the-sheet-to-stand-still-flake-start-undo) | low | 0 |
| T02 | [One duct system rule and the loop breaker, both in `ductChildLinks`](#t02-one-duct-system-rule-and-the-loop-breaker-both-in-ductchildlinks) | low | ~15 |
| T03 | [idb.js: a re-put is a replace](#t03-idbjs-a-re-put-is-a-replace) | low | ~10 |
| T04 | [A quoted chip finds its control](#t04-a-quoted-chip-finds-its-control) | low | 1 |
| T05 | [The water tap rule and the behind-the-tip count: one decision](#t05-the-water-tap-rule-and-the-behind-the-tip-count-one-decision) | ⚑ call | ~20 |
| T06 | [One trade resolver](#t06-one-trade-resolver) | ⚑ call | ~5 |
| T07 | [The duct riser reads the room the way Bid Check does](#t07-the-duct-riser-reads-the-room-the-way-bid-check-does) | low | 3 |
| T08 | [The manual Check Out gets a timeout](#t08-the-manual-check-out-gets-a-timeout) | low | ~10 |
| T09 | [One device-key list](#t09-one-device-key-list) | low | ~20 |
| T10 | [A teaching-set name is refused at every door](#t10-a-teaching-set-name-is-refused-at-every-door) | low | ~15 |
| T11 | [Spec-copy ratchet, per file, then the spec-helpers migration](#t11-spec-copy-ratchet-per-file-then-the-spec-helpers-migration) | low | ~850 |
| T12 | [Shared step reader and teaching-file finder for the tooling](#t12-shared-step-reader-and-teaching-file-finder-for-the-tooling) | low | ~55 |
| T13 | [One touch test, in the kit](#t13-one-touch-test-in-the-kit) | low | ~15 |
| T14 | [tour-geometry.js, with placeCard](#t14-tour-geometryjs-with-placecard) | low to medium | ~250 |
| T15 | [Duct schedule core and its text builders into the model](#t15-duct-schedule-core-and-its-text-builders-into-the-model) | medium | ~195 |
| T16 | [One tool-input table and the six rect-click branches](#t16-one-tool-input-table-and-the-six-rect-click-branches) | medium to low | ~65 |
| T17 | [Copy surfaces and the fixed-menu opener, table-driven](#t17-copy-surfaces-and-the-fixed-menu-opener-table-driven) | low to medium | ~110 |
| T18 | [Save-engine dedupe, round 2](#t18-save-engine-dedupe-round-2) | low to medium | ~65 |
| T19 | [app.js leftovers to the files that own them](#t19-appjs-leftovers-to-the-files-that-own-them) | low | ~310 |
| T20 | [Checkout recovery into turn-in.js](#t20-checkout-recovery-into-turn-injs) | medium | ~190 |
| T21 | [Project open into its own file](#t21-project-open-into-its-own-file) | low | ~215 |
| T22 | [One teaching device snapshot, then Learn's machinery out of lessons.js](#t22-one-teaching-device-snapshot-then-learns-machinery-out-of-lessonsjs) | medium | ~475 |
| T23 | [The trade tours out of the engine](#t23-the-trade-tours-out-of-the-engine) | medium | ~900 |
| T24 | [The duct air layer into duct-air-model.js](#t24-the-duct-air-layer-into-duct-air-modeljs) | medium | ~1,250 |
| T25 | [Bid Check: the gate delegates to the model, one contributor list](#t25-bid-check-the-gate-delegates-to-the-model-one-contributor-list) | medium | ~65 |
| T26 | [Node tests for report.js's text and payload builders](#t26-node-tests-for-reportjss-text-and-payload-builders) | low | 0 |
| T27 | [MAP-PERMS: delete the list fallback, on or after 2026-10-04](#t27-map-perms-delete-the-list-fallback-on-or-after-2026-10-04) | low | ~100 |
| T28 | [Small dedupes and the doc sweep](#t28-small-dedupes-and-the-doc-sweep) | low | ~500 |

**Not on the list, on purpose: the gesture core.** The mouse, wheel and touch handlers in `app.js` are 1,274 lines by the skeleton's sections (Canvas Event Handlers 382, Aim loupe 153, Zoom preview 79, mouse/wheel/touch 660), and they had zero changed lines this window, so by the last map's own rule it is not time. T16 has to land first. Wheel and pinch still share closure variables with `renderPdf` (`lastRenderedZoom`, `wheelZoomCommitTimer`, `wheelZoomLastEventTs`, `zoomGestureDirection`) and stay where they are in any move. One correction to the last map: touch tap-and-hold IS driven by specs, through `window.__fireTouch` (aim-loupe-phase2.spec.js:74, measure-loupe.spec.js:76, bend-fittings.spec.js:272, 283). Still undriven by any spec: a pinch, a middle-button or one-finger pan, the note grips (`noteResize`, `noteFontSize`), a legend drag, and a long-press on a mark in Move.

### T01. The lesson spec waits for the sheet to stand still (FLAKE-START-UNDO)

Punch row FLAKE-START-UNDO, explained by reading. The engine focuses the sheet onto a step's circles on a 60 ms timer after the step opens (`features/tutorial.js:2112`); under Playwright the move is a jump, not a glide (`1982-1988`, `navigator.webdriver`), but it still fires 60 ms late. The spec's `circle()` (`lessons.spec.js:210`) returns `App.tutorialZoneScreen()` as soon as a zone exists, which is true at step entry, then clicks 60 px above that pre-jump point (`:212`). When the timer fires between the read and the click, the click lands at a stale screen point, no mark is placed, and `tryProgress` (`features/lessons.js:171`) keeps saying "Click outside the circle first", the row's exact symptom. The same race was already fixed for the right-click in the same spec (`lessons.spec.js:466-467`, wait until `zoom:pan` has stood still 700 ms). **Fix:** that wait inside `circle()`, or wait on `App.tourKit.gliding()` (`tutorial.js:2313`) plus one tick. **Pin:** the spec itself, 20 runs at 4 workers, the row's own repro. FLAKE-WATER-FIELD is not explained by its waits (the path from the name's `input` event to the Cold radio is synchronous, `features/water-runs.js:57-79`); it needs a trace from a failing run, and the row stays.

### T02. One duct system rule and the loop breaker, both in `ductChildLinks`

Two confirmed defects with one home. **The system rule (Q08, was N09):** run in node at HEAD, a main under `RTU` carrying a 300 CFM device and a branch with no system tapping it at mid-run with 200 CFM: `ductSystemDesignedCfm({ RTU })` is 500 (`duct-model.js:1663` counts the branch through its root), `tallyFlexDrops` returns two rows, `RTU` and `null` (`:1555`, printed as "No system" by `features/duct-schedule.js:203`), `ductDeviceSystemId` of the branch device is null (`:1265`), and `ductDraftRemainingCfm` reads 300 under RTU and 200 under null (`:1416`). Four surfaces, two rules: the root's system (designed, the static path per its own doc at `:2195`) against the run's own (flex, the draft remainder). **The loop (Q02, punch row DUCT-TAP-LOOP):** two runs drawn head to tail (A from (0,0) to (100,0), B from (100,0) round to (0,0)) are each the other's child (`:1223-1232`; the guard at `:1254` skips only a parent whose first vertex sits on the child's first). Then designed CFM is 0 (every run has a parent, `:1662`), the static path is null, and the fittings walk yields two taps (`:824-827`); `ductDownstreamCfm` still returns the load and terminates (the visited set at `:1322`). Three runs round a square give a 3-cycle, and the water copy (`water-model.js:396`) does the same. A plain continuation (B starts on A's end, A's start off B) gives one link and is fine.

**Recipe:** one `ductRunSystemId(run, runs, opts)` in the model that walks `ductTapParentOf` to the root and returns the root's system, else the run's own; `tallyFlexDrops` and the draft scope read it. In `ductChildLinks` after collecting, break each mutual pair: keep the link whose parent's first vertex is nearer `opts.equipmentPos` (every caller already passes it), else the earlier run in the list. **Pin:** two cases in duct-model.test.js beside the DS-DINING-ATTACH sibling test at `:1052`: the two-run system case (flex under RTU, `totalCfm` 500) and the loop (one link, designed 500 not 0, a static path, one tap). Existing tests (`:1369-1393`, `:1505`) never mix a null-system child under a system root, which is why neither showed. This is the code half of punch row DUCT-RUN-SYSTEM; the product half (a System choice for a run) is the old S09, below in T28's "after the call" note.

### T03. idb.js: a re-put is a replace

Q03 (was N18, "read"), now confirmed in node with fake-indexeddb, three shapes, all at `idb.js:141-148` (`pdfCachePut`) and `209-216` (`idbTakeoffBackupPut`): (A) at the entry cap of 10, a re-put of a middle key evicts the oldest neighbour though the put replaces a key and the count would not grow (`entries.length < MAX` is false at 143 and the self-check at 144 never fires because the oldest is a different key); (B) over the byte cap, when the re-put key IS the oldest, the loop breaks on it at 144 and never reaches the next-oldest: a (100 MB) + b (300 MB), then a re-put as 400 MB, leaves 700 MB in a 500 MB cache; (C) the takeoff-backup store shows (A) at its cap of 5. **Fix:** before the loop, drop the entry whose key equals the one being put from `entries` and `totalBytes`, then loop without the self-check. **Pin:** cases (A) and (B) in idb.test.js on each store.

### T04. A quoted chip finds its control

Q04, a ripple of the XSS sweep (09618ac9). `chipsOf` (`features/tutorial.js:1438`) escapes a card's body first, so a chip label reaches `chipHtml` as `1/8&quot; = 1&#39;`; `unescapeText` (`:1381`) restores only `&lt; &gt; &amp;`, so `controlFor` (`:1384`) looks for a button whose text is the escaped string and finds none. The chip renders plain, no icon and no click, even with the Set Scale dialog up, where the preset button's text is exactly `1/8" = 1'`. Ten cards carry such a chip: tutorial.js:286, lessons.js:569, 582, course-plumbing.js:369, 634, 743, 754, course-electrical.js:342, course-hvac.js:382, 605. The string half was confirmed in node; the DOM half read. **Fix:** `unescapeText` learns `&quot;` and `&#39;`. **Pin:** a tutorial.spec.js case at the scale step with the dialog open asserting the `[[1/8" = 1']]` chip has `.tour-ui-live`.

### T05. The water tap rule and the behind-the-tip count: one decision

Punch row WATER-TAP (Q01, was N01, confirmed again at HEAD: two cold runs leaving one point each get both loads, `water-model.js:396-410`). The first fix, #262, was the duct twin's sibling guard and was reverted the same day because the plumbing tour's size step traces the main FROM the riser the lavatory branch also starts at (`features/tutorial.js:509-549`, `700-733`): the main's first vertex is the branch's first vertex, which is the bug's own shape. A second twin was found this pass, Q09: the water draft counts a branch tapped behind the tip (`water-model.js:433-441`, the `subtree` walk takes every child) while the duct draft counts only a tap at or past the tip (DS-DUCT-DOWNSTREAM, `duct-model.js:1369-1392`). On the tour's exact geometry the duct rule reads 0 ahead for a trunk traced away from the battery and 300 traced toward it. So the tour as drawn leans on TWO water rules the duct twin has already changed.

Every candidate rule was run in node against three cases (the bug; the tour as drawn; the tour with the main traced the other way, ending at the riser):

| Rule | Bug case (want 1.5 / 10) | Tour as drawn | Tour traced toward the riser | A main with its own fixture and a branch off its start (want 6 / 4) |
|---|---|---|---|---|
| A. bare rule at HEAD | 11.5 / 11.5 | 4.5 | 4.5 | 6 / 6 |
| B. #262, duct's sibling guard | 1.5 / 10 | card never appears | 4.5 | 2 / 4 |
| C. sibling guard unless the parent has no fixtures of its own | 1.5 / 10 | 4.5 | 4.5 | 2 / 4 |
| G. the draft is never anyone's child; committed runs get B | 1.5 / 10 | 4.5 | 4.5 | 2 / 4 |
| D. a riser Drop at a run's first vertex marks it as fed | 1.5 / 10 | 4.5 (the Drop step precedes the size step) | 4.5 | not simulated |

Every sibling guard (B, C, G) under-sizes a main that really does feed a branch off its own start, because the model cannot tell direction from geometry. C makes a run's links depend on what is attached to it, so adding a lav re-shapes the tree. G makes the S moment and the Water Sizing schedule disagree on the same pipe, and the `water_run` telemetry (`features/water-size.js:254`) logs the schedule's number. D reads the one mark the estimator already places for a fed branch: `waterRunsFromAnnotations` (`water-model.js:291-308`) would carry a `dropAtStart` from the drop nodes (app.js `collectDropNodes`; `tutorial.js:1171-1176` shows the read), and the tour's own riser card (`:661`) already teaches "the branch comes up from below the slab". B with a tour redesign (the size step traces toward the riser: card text `:712`, `:715`, the zones `:728-729`, the driver `:536-549`, the copied text in tutorial.spec.js:1203 and C4 at `:1415-1458`) is the other honest option; the hero plumbing film is not affected either way (its trunk taps the service mid-run, `scripts/build-hero-video.js:340-341`). **The decision is between the model's convention (first vertex = the tap, load ahead of the tip, the duct rules) and the tour's trace direction, not both.** After it: the guard and the tip rule in water-model.js, about 20 lines; a loop breaker in both networks (T02); node cases mirroring duct-model.test.js's, then tutorial.spec.js with the water specs.

### T06. One trade resolver

Punch row TRADE-DEFAULT, unchanged. Twelve raw decision reads of `state.trade` on eleven lines at HEAD: features/bid-check.js:150 (feeds the electrical block at 153, the plumbing block at 165 and the manual filter at 174), 268, 276; conductors.js:45, 64; circuits.js:39; tag-reader.js:63, 332; room-sizer.js:203; canvas-legend.js:243, 290. Two resolvers: `getQuickTrade` (app.js:125-129: project, else device default, else plumbing) and `statedTrade` (features/header-more.js:97-103: project, else device default, else null, with its own `TRADES` literal at 99 beside constants.js:35). On a project that never named a trade, Bid Check shows water rows and the IPC edition but no hanger, fitting or plumbing manual rows (Q11). **Needs the product call first:** does the device's default trade count as the project's? Then one resolver, about 5 lines, and T25 after it.

### T07. The duct riser reads the room the way Bid Check does

Q14 (was N17), a three-way twin, not two. The auto riser (`features/duct-tool.js:301`) takes the FIRST containing room box on the merged annotations; the Bid Check roof row (`features/duct-bidcheck.js:92-99`, `segmentCeilingFt`) takes the smallest through `App.roomHeightAtPoint`, whose rule (`features/room-sizer.js:782-795`) is the smallest-area containing box across every layer; the draft roof check (`duct-bidcheck.js:215`) already uses it. **Fix:** `:301-302` becomes `App.roomHeightAtPoint(v0, pageIdx)`. **Pin:** a duct-tool.spec.js case with two nested room boxes of different heights, the riser equal to deck minus the inner room's ceiling.

### T08. The manual Check Out gets a timeout

Q10 (was N13). `features/turn-in.js:83` awaits `rpc('check_out_project')` with no timeout while every engine RPC wraps (`ctx.withTimeout(..., CHECK_IN_TIMEOUT_MS)` at save-engine.js:1542-1546 and 1167); on a wedged client the buttons stay on "Checking out..." until a reload. `App.withTimeout` is published (app.js:6689). **Fix:** wrap it, toast on the timeout, re-enable the button. **Pin:** a Playwright case that routes `/rest/v1/rpc/check_out_project` to hang and expects the toast and a live button within the timeout.

### T09. One device-key list

Q13 (was N16), recounted: `features/project-settings.js:345` (the Clear cached data button) holds 21 keys, `save-engine.js:2926` (the admin force reload, `doGlobalReloadNow`) holds 19; the differences are `clickcount-last-project` (left out of the engine's on purpose, comment at 2922) and `stripPins` (project-settings only). Neither list is a sign-out: the `stripPins` sites are the read at app.js:425, the write at header-more.js:141 and this wipe, so AGENTS.md's "wiped by the sign-out key list" names a list that does not exist. **Fix:** one `DEVICE_KEYS` in constants.js read by both, the pointer as the named exception; AGENTS.md says which button wipes what. **Pin:** a constants.test.js case that every key AGENTS.md lists as wiped is in it.

### T10. A teaching-set name is refused at every door

Q22, found while checking PROJECT-RENAME's landing. `renameProject` refuses a teaching-set name (`isSampleName`, "That name belongs to a sample plan") because `features/tutorial.js:1007` `leaveForTeachingSet` silently resets a project whose name is one of `TEACHING_SETS` (`:988-994`) at its page count. The Save dialog (`features/save-project.js:183` into `save-engine.js:2433`) and Prepare PDF's name field (`features/prepare-pdf.js:620`) still write the name unguarded, so a bid saved as `sample-plan` with one page is reset without a question the next time a tour starts. Latent, low: the names are slugs. **Fix:** one `App.projectNameAllowed(name)` in project-settings.js used by all three. **Pin:** a project-rename.spec.js case that types `sample-plan` into the Save dialog and expects the toast. The rename itself landed clean: one writer, and the name rides the autosave, the manual save, the last-project pointer, the IndexedDB backup and the recent-bids list.

### T11. Spec-copy ratchet, per file, then the spec-helpers migration

Nothing moved and no ratchet exists. Recount at HEAD, 191 spec files, with the greps the map carries:

| Shape | Grep | At `3eb45a9` | Now |
|---|---|---:|---:|
| boot-wait copies | `grep -c "waitForFunction.*bootSettled" *.spec.js \| awk -F: '{s+=$2} END{print s}'` | 251 | 251 |
| boot waits that pass when app.js never loaded | `grep -c "!window\.App *\|\|" *.spec.js \| awk …` | 240 | 240 |
| upload copies | `grep -c "pdfInput.*setInputFiles" *.spec.js \| awk …` | 184 | 184 |
| console collectors | `grep -c "page\.on('console'" *.spec.js \| awk …` | 224 | 222 |
| specs importing spec-helpers.js | `grep -l "require('./spec-helpers')" *.spec.js \| wc -l` | 25 | 28 |

By file: 159 specs carry an inline boot wait, 157 an inline collector, 134 an inline upload. The two specs added since the last map (project-rename, tour-restart) import the helper and paste none of the three, so the AGENTS.md rule held this time. Six files import the helper AND keep their own boot wait (course-plumbing, grid, mobile-touch, lessons, turn-in-self-release, tutorial), so the ratchet has to count per file, not only per suite. The new `stepTo` (spec-helpers.js:129-140, the card pass) has 7 readers and no local copy anywhere, which is the shape this item wants. **Recipe:** first a node test that counts the shapes per file and fails when a count rises; then migrate in batches and lower the ceilings; `pastStartHere` (spec-helpers.js:116-123) becomes `bootApp(page, { returning: true })`. Yield about 850 lines (the last map's 600 was conservative).

### T12. Shared step reader and teaching-file finder for the tooling

The drift widened. `scripts/score-courses.js:308-356` copies the AST text reader of `scripts/check-lesson-rules.js:57-108`; `sentences` is `147-159` against `460-472`. score-courses.js was touched by 9 commits since the last map, check-lesson-rules.js by 1, and they now disagree three ways: score-courses reads a card's `title` as text while check-lesson-rules' `TEXT_KEYS` (`:54`) has no `title`; check-lesson-rules reads through identifiers bound to string constants (`:81-108`, `decls`) and score-courses does not; the two `ABBREV` lists differ (`:146` against `:458`). The teaching files are hand-listed twice (`SOURCES` `check-lesson-rules.js:50-53`, `COURSES` `score-courses.js:51-60`) and derived once (teaching-labels.test.js:35-38). `features/learn-taps.js:40-44` `nameRe` still hand-copies `score-courses.js:512-516` `termRe` and nothing pins that they agree (learn-taps.test.js requires score-courses.js only for `COURSES`). `scripts/card-walk.js` (new) does not copy the reader; it copies a boot wait (`:32`). **Recipe:** `scripts/lib/step-source.js` with the reader (a `keys` option, the `decls` read-through) and `teachingFiles()`; a learn-taps.test.js case that runs `nameRe` and `termRe` over a fixed word list and asserts equal matches. Do this before T23, which adds a teaching file.

### T13. One touch test, in the kit

The engine's `isTouch` / `isNarrow` (`features/tutorial.js:1452-1453`) are not in `tourKit` (`:2305-2311`), and the same `window.matchMedia('(pointer: coarse)')` was written seven times, five of them the day after `lessonKit.onTouch` had been exported (lessons.js:158, dd84ceaa): tour-blank.js:407-409, course-plumbing.js:346 and 573, course-electrical.js:538, 582 and 694. The HVAC course reads `K().onTouch()` (course-hvac.js:558, 585), so the kit route was there and used. The undo phrase rides with it in three copies (lessons.js:159 and 170, tour-blank.js:411-412, course-electrical.js:694). **Recipe:** `tourKit.isTouch` / `isNarrow` from the engine, `lessonKit.onTouch` delegating, an `undoKey()` beside it; the five course sites and tour-blank read the kit. About 15 lines. **Pin:** a node case in teaching-labels.test.js's style that greps the teaching files for `matchMedia(` outside tutorial.js and fails on a hit.

### T14. tour-geometry.js, with placeCard

Grown since the last map. `render` is `features/tutorial.js:1475-1724`, 250 lines (was 188); card placement `1615-1717`; zone math `153-215`; `measureProof` `235-268`. The copies multiplied with the card pass: the four-corner list three times (`1646`, `1667`, `1708`); the corner-overlap predicate three times (`clear` at `1647` and `1709`, `hits` at `1662`, the third with b1a8d54c's cost block); the `cardAt` formula twice (`1641`, `1702`); the window clamp in both branches (`1685`, `1714`); the sheet-to-screen mapping three times (`drawZones` `1749`, `zoneScreenBoxes` `1926`, `App.tutorialZoneScreen` `2318`); the nearest-circle loop twice (`168-170`, `237`). New pure-shaped code that belongs in the same module: `panFromBox` `1898-1923`, the zoom arithmetic in `focusOnZones` `1939-1962`, the glide easing `1993-2001`. `seen` and `underStickyRow` (`1787-1809`) are DOM reads and stay. **Recipe:** tour-geometry.test.js first (corner order, zones clear, a card taller than the corner allows); then a pure module with a CommonJS footer, the way learn-taps.js does it, holding `placeCard`, `markZones`, `pathZones`, `boxZone`, `panFromBox`, `focusOnZones`'s arithmetic. About 250 pure lines: zones 63, measureProof 34, placement ~100, pan 26, focus 24. Today the only pins are Playwright (tutorial.spec.js:655, 737, 923, 947 and the two card-pass cases); there is no `*.test.js` for the engine.

### T15. Duct schedule core and its text builders into the model

Unchanged. `computeDuctSchedule` (`features/duct-schedule.js:126-258`) is the bid weight PipeTooling receives, and only duct-schedule.spec.js reaches it. The text builders beside it: `buildDuctScheduleText` `:453-505`, `buildDuctCopyRows` `:506-526`, `buildDuctReportHtml` `:596-629`. `rollupRunsToSchedule` (`duct-model.js:700`) is still read by nothing in the shell, only by duct-model.test.js:414-424 (D41). **Recipe:** a node golden test first (mixed classes, one zone, grease, flex over the cap, a damper per tap, counted against factor); then `ductScheduleFromPages` in duct-model.js, the feature keeping the `App.*` reads, replacing `rollupRunsToSchedule`; the builders move with it, with a round-trip test into report.js's `summarizeToolingExport` (`report.js:610`).

### T16. One tool-input table and the six rect-click branches

The six hand-kept lists, re-resolved: `isAimingTool` app.js:5300, `RECT_TOOL_START_KEY` 5293, the mousemove band gate 5744 (no MEASURE, which is Q07), the touchmove gate 6076 (no DELETE_ZONE, CHAIN, GHOST, POLYLINE, DUCT, MEASURE, so a finger drag with a Delete Area corner still shows no band), `clearToolStarts` 2901, the Esc table's `start:` fields (`features/esc-ladder.js:125-158`). A seventh the last map did not count: the six rect live previews in `renderAnnotationsInner` (app.js:2280, 2289, 2297, 2305, 2313, 2334), each `state.tool === TOOL.X && state.xStart && state.mousePos`. One correction: `RECT_TOOL_START_KEY` is already the derived table for the rect-DRAG gesture (press 5612, promote 5637, complete 5867, abort 5889); the helper half of this item is narrower than the last map said, the six two-click branches in `handleCanvasClick` (HIGHLIGHT 5057, MULTIPLY_ZONE 5074, SCALE_ZONE 5099, SCHEDULE 5131, ROOM 5143, DELETE_ZONE 5161), each repeating the bounds check, first-corner set, normalise, clear and re-render. **Recipe:** one `TOOL_INPUT` keyed by tool carrying `{ startKey, aims, bandsOnMouse, bandsOnTouch }`, the lists derived from it, and `rectToolClick(pdf, onRect)` for the six branches. Q07 was closed on 2026-09-28 by the one-line gate fix (MEASURE-BAND, pinned by measure-band.spec.js on the overlay's pixels); the table still derives that branch when it lands. tool-resets.spec.js, aim-loupe-phase2.spec.js and measure-loupe.spec.js already drive these paths. This is the gesture core's precondition.

### T17. Copy surfaces and the fixed-menu opener, table-driven

The three dropdown openers in `features/output.js` are now `726-756`, `774-800`, `814-844` (the bundle buttons joined the file at 432-467), with three option handlers (`758-770`, `801-812`, `868-880`) and the single-scope short-circuit repeated in each; the same 20 lines three times. What differs on purpose is unchanged: the two Tooling menus prefetch the view link (738, 785) and drop up (750, 794); Copy Summary opens below when it fits (833-838). New this pass: `features/duct-fittings.js:186-202` and `features/bend-override.js:62-78` are the same fixed-menu opener (build the buttons, `placeFixedMenu`, the four document listeners), differing by `keepOpen`. **Recipe:** `openAnchoredMenu` and a `COPY_SURFACES` table bound by one `wireCopySurface`; the two fixed menus fold into the same opener. About 110 lines. Do not split output.js until this lands.

### T18. Save-engine dedupe, round 2

Every count unchanged at HEAD, 0 commits: the last-project pointer written three times (save-engine.js:2469, 2804, features/copy-project.js:83), the update payload four (2323, 2335, 2365, 2701), the with-PDF update twice (2323-2331, 2335-2344), the manual raw insert twice (2280-2296, 2399-2416), the rescue probe five (2290, 2372, 2408, 2737, 2781), a changed PDF hashed twice (`sha256Hex` 2252, 2308). One behaviour change rides along and should be named in the commit: the with-PDF manual updates at 2327 and 2340 throw without `noteSupabaseJsFailure`; only the no-PDF path records it (2388). Helpers inside the factory; the file stays one file.

### T19. app.js leftovers to the files that own them

Re-resolved and one twin added. The canvas-only-needs-PDF dialog and the pdf-lib helpers (app.js:3683-3743, the handlers 4855-4875) to load-project.js and pdf-intake.js; every reader is already `App.*`, about 60. The auth chrome in `updateUIInner` (2760-2799) to bid-board.js, status-bar.js and project-settings.js, about 40. The My Settings folds (4670-4693, two IIFEs differing by three ids) and the load and copy cancels (4767-4772), about 30. The live-preview helpers inside `renderAnnotationsInner` (2024-2415, still 392 lines): the scale crosshair glyph four times (2050, 2070, 2115, 2142), the dashed reference segment and its length label twice each (2066, 2083, 2111, 2125), seven rubber rectangles (2280 to 2345), AND the draw env literal built twice (2192-2205 for ghosts, 2213-2226 for the marks, 14 identical lines, confirmed by diff: a sizing key added to one draws ghosts and marks at different scales). The scale reference line and the preset scale bar (2064-2093, 2110-2136) are one drawing written twice; a pure `drawScaleReference(ctx, tc, a, b, label, dpr)` belongs in canvas-draw.js beside `drawDropMarker`, and no render-pixels baseline draws it today, so a pixel baseline with the toggle on comes first. Together about 105. `App.armPlacing`, one arm path for the six feature-file pickers (choose-create-line-type.js:60-72, counter.js:86-96 and 484-490, quick-modals.js:402-409, tag-reader.js:287-289 and 296-304; each copies the tool set, the pages-collapse triple that `App.collapsePagesSectionForPlacing` already publishes, and `closeMobileSidebar`; `setActiveCounterType` at 2940 does it right), about 25: it closes Q12 (a Measure first point's crosshair rides under the counter, because `renderAnnotationsInner` draws it whenever `scalePointA` is set with no tool gate at 2046, unlike every rubber band after the MAP-RESETS comment at 2245). A `TOOL_BUTTONS` table for the seven same-shape arms (3873-3916), their sidebar twins (3926-3942), the active-class toggles in `updateUIInner` (2577-2686) and `viewerHideIds` (2708); `features/tool-context-menu.js:31-45` already holds a per-tool action map it could share, about 50. Optional: the Polyline dialog is the last modal whose every binding is app.js's (13 of 13): the opener body 3851-3871 and Start/Cancel 4157-4173 to `features/polyline-modal.js`, about 55 more.

### T20. Checkout recovery into turn-in.js

Unchanged, 0 commits. app.js 4565-4628 (`formatExpiryAge`, `applyCheckoutExpiredRecoveryMode`, `openCheckoutExpiredRecoveryModal`, its close, the `reCheckOutAfterExpiry` wrapper) and 4773-4854 (`wireCheckoutExpiredRecoveryModal`, `wireSaveStatusExpiredCallout`), inside `if (SUPABASE_ENABLED)` (4429-4883); `copyOrCreateViewLinkToClipboard` (4509-4527) goes to share-links.js. Still no spec drives the recovery dialog (save-engine.test.js pins the engine's `reCheckOutAfterExpiry`, modal-gallery.js only populates it). **Recipe:** the spec first; then the move, the engine ctx entry at app.js:680 becoming a deferred read, `formatExpiryAge` to format.js with a node case. It ends Q20 for two of the three block-declared functions; `checkInCurrentProjectIfHeld` (4553) goes with T21.

### T21. Project open into its own file

Unchanged. `features/copy-project.js:55-138` and `features/load-project.js:426-557` hold the six functions every intake uses to open a cloud project; restore-last-session.js:167 restates the only-copy rule inline. What remains of D28: bid-chip.js:219 and pdf-intake.js:177 each call `list_accessible_projects`, every project's whole takeoff, to open one. **Recipe:** `features/project-open.js` with the same App names, `checkInCurrentProjectIfHeld` with it, and a one-project RPC for D28 modelled on the MAP-PERMS migration.

### T22. One teaching device snapshot, then Learn's machinery out of lessons.js

Unchanged in shape, re-measured. Two search writers (tutorial.js:2124-2132, lessons.js:1055-1065: the same three fields in two shapes), two keys (`clickcount-tour-searches-before`, `clickcount-lesson-device-before`), two boot pollers of one shape (tutorial.js:2290-2301, lessons.js:1254-1262). TOUR-RESTART made their order load-bearing (the old stop drops its snapshot before the new start takes the reader's), which is the argument for one snapshot. `LESSONS` (468-995) with the sheets' geometry and the lesson-0 readers is about 600 lines of content; the other ~680 (53%, the last map said 60%) is machinery: kit helpers, palette tracking, open/seed/openStep, progress and the Learn menu, the device snapshot, the course runner, the wiring and the upload rule. **Recipe:** `features/learn.js` between tutorial.js and lessons.js publishing `App.learnKit`; lessons.js keeps the sheets' geometry and `LESSONS`. About 475 lines.

### T23. The trade tours out of the engine

The tours are `features/tutorial.js:270-952` (the shared steps and the three trade tours, 683 lines) and their do-it-for-me actions `1086-1315` (230): 913 of 2,433, 37.5%. All three preconditions still hold: the empty-canvas links are wired at load from `TOURS` (2268-2271) and `App.registerTour` (2288) only assigns; the trade tours' variables are reset inside `startTutorial` (2167); `pushLineType` (1063-1070) writes `tourLineTypeId` instead of returning the id. Two engine helpers the tours lean on are not in `tourKit` and move with them or into it: `firstShowing` and `SHOWN` (280-281, 32 uses). Then `features/tour-trades.js` (a `tour-` name, so the teaching-file finder matches it). After T12. About 900 lines.

### T24. The duct air layer into duct-air-model.js

Unchanged, re-measured from the definition lines: attachment through `suggestSystemsForCfm` `duct-model.js:1025-1728` (about 700, of which the tap topology `:1068-1100` and `:1223-1264` stays in core, about 75), the ductulator `:1757-1896`, necks `:1921-1964`, depth and plenum `:1965-2104` (less `ductPlanWidthIn`, which is drawing), the static path `:2105-2346`, the Bid Check rows `:2347-2454`. About 1,250 to 1,300 lines. Of the 37 `code:` pointers in content/rules/hvac, 28 point into duct-model.js and six move with the cut (`NECK_SIZE_TABLE[*].maxCfm`, the four `ROOM_TYPE_CFM_PER_SQFT.*`). **Before it:** a cross-script top-level-name check in `build:projectmap --check` (Q18: `fmtIn` `:2031` is a function declaration, `fmtInWg` `:2313` and `plural` `:2347` consts, no collision today) and the three names prefixed. Do it when the next air feature lands.

### T25. Bid Check: the gate delegates to the model, one contributor list

Smaller than mapped. The model already holds `bidCheckUnresolved(rows)` (`bid-check-model.js:218-222`, node-tested, delegated to by duct-model.js:2432 and water-model.js:644), and `gateStatus` (`features/bid-check.js:349-357`) re-filters by hand only because the trade's manual rows built at `:174` carry no `kind`. **Recipe:** stamp `kind: 'manual'` at 174, make `gateStatus` a delegate, move the gate's memory (`unresolvedRows`, `rowsKey`, `isAcknowledged`, `acknowledgeGate`, `:367-382`) to the model as pure functions over `ack`, about 25; then one `CONTRIBUTORS` list in place of `FOLDED_ADVISORY_SURFACES` (336), `GATE_CONTRIBUTORS` (339-342), the duct block (181-186), the water block (188-193) and `extraManual` (194), about 40. Land after T06, since `:150` gates the electrical and plumbing contributors on the trade. Small twin on the way: the manual rows `duct-fire-dampers` and `duct-oa-code` (`duct-model.js:2403-2404`) have rulebook twins (`hvac.damper.fire-damper`, `hvac.ventilation.outdoor-air`) but the § chip is rendered only on auto rows (`bid-check.js:228`); the manual renderer (`:246-262`) never reads `r.rule`, about 5 lines.

### T26. Node tests for report.js's text and payload builders

Still none, and it matters more now. `getPipeToolingSummary` (report.js:464), `getTakeoffToolingPayload` (563) and `getEmailTextSummary` (712) are pure over `state` and have no node test; the footer (`:870`) exports nine helpers and none of them; the XSS sweep changed `buildReportHtml`'s cells at 272, 297, 344, 351, 358, 401, 428 and only Playwright saw it. The harness: `globalThis.window = globalThis`, a `state` fixture and stubs for the contract globals AGENTS.md lists, the footer adding the three builders. No lines move; this is the pin under T15 and T17.

### T27. MAP-PERMS: delete the list fallback, on or after 2026-10-04

Punch row MAP-PERMS, smaller than its row says. The test rewrite is one helper default, not twenty tests: `save-engine.test.js:535-546` `rpcWithProjects` answers `get_project_permissions` with PGRST202 unless `outcomes.lean`; 44 call sites take the fallback and 2 pass `lean: true`. Flip the default, delete the two fallback pins (960, the 404 half of 994) and the three inline mocks (1135, 1883, 1942), and the 44 walk the feature untouched. In the engine: 882-911 (the latch, `isMissingRpcAnswer`, the fallback branch), the reset at 570, `rawListAccessibleProjects` (721, 3197) if nothing else reads it. About 40 engine lines and 60 of tests, after a week of the RPC on prod.

### T28. Small dedupes and the doc sweep

Each under 50 lines, grouped by area. **Registry:** five dead registrations to delete, judged one by one (`App.pickScaleForLineType` app.js:6518 and its entry in lines-list.spec.js:33's presence list; `App.openBidCheckAtRow` bid-check.js:490; `App.applyEditBannerHold` turn-in.js:141; `App.learnWordsSearch` learn-words.js:99; the `App.onRulesLoaded` call at rules.js:58 that nothing registers), and one optional (`noteViewerTempScale`, a documented test seam); the other nine on the skeleton's list are live (same-file reads, a cross-frame read, persona-driver, and four read by report.js through its string seams, see section 6). **Quick keys:** `features/quick-keys.js:34` keeps its own `SLOTS` with three readers while the new code reads `M().QUICK_KEY_SLOTS` (Q23); delete it. The counter icon SVG is hand-built in four places beside `iconSvgHtml` (app.js:2612, 2629; quick-keys.js `symbolHtml`, `renderStrip`), all escaping correctly today; give `iconSvgHtml` an options bag `{ size, className, stroke }`. **Render and UI:** the legend's default box literal three times (app.js:2404, 2448, 3956, each with its own `getViewport`; canvas-legend.test.js:263 hardcodes the same `612 - 110`), one `defaultLegendBox(page)`; `updateUIInner`'s viewer reset (2690-2698) restates `resetToMove` (2923-2933), one `dropEveryTool()`. **Settings dialogs:** legend-settings table-driven (ten dead `if (App.markProjectDirty)` guards at legend-settings.js:84 to 201; five toggle pairs of 13 lines; a `TOGGLES` table like counter-settings.js:102-113, about 65); the paired icon grid binder (item-details.js:243-259, counter.js:242, quick-modals.js at seven sites, custom-icon-upload.js at three), one `bindPairedIconGrids`; the two zone-settings dialogs (scale-zone-settings.js and multiply-zone-settings.js, 74 and 77 lines, the same toggle, slider and select), about 60, optional; the item-details optional number fields (`cfm` 135-146, `flexDropFt` 194-205), one `bindOptionalNumberField`, about 20; the Summary's flat branch (summary-list.js:163-211) re-tallies what `renderItems('null')` already draws, about 45, with a spec first that compares the flat and grouped rows on a multiply-zone sheet. **Teaching:** `counterFormTargets` and `lineTypeFormTargets` (tutorial.js:1829-1842) are one idea twice, fold with T14 or T23; `SECTION_RE` (1424) derived from `SECTIONS` (1423); the palette ids in three lists (1863, 1886, 2072). **Duct:** `ductDistToSegment` and `ductDistToPolyline` (duct-model.js:774-785, exported at 2591) and `DUCT_MATERIAL_IDS` (:329) are dead (no shell reader, no test); `collectDuctDevices` and `collectPageMarkers` (duct-suggest.js:73-91, 133-147) share a walk, one `forEachPlacedMarker`. After the DUCT-RUN-SYSTEM call: a System segment on the run menu modelled on `setRunAirside` (duct-fittings.js:350), or the toast at duct-tool.js:411 reworded (Q06). **Rasters:** the Drop overlay takes `currentEffDpr` as an argument (Q15, drop-mode.js:114, from app.js:2278); the worker's PDF options ride the load message (Q16, render-worker.js:114-124 from `PDF_OPEN_OPTIONS` app.js:13-17, `render-service.js:192`); `cacheFirst` in sw.js skips `/samples/` and `networkFirst` puts under `/app/` without the query (Q17, sw.js:488 and 467); the prefetch raster block twice in pdf-tile-cache.js (406-426, 500-518), optional. **Tooling:** the static server has four copies, two already drifting (build-modal-gallery.js:58-69 = build-screenshots.js:61-72; build-hero-video.js:96-109 drops `path.normalize`; persona-driver.js:22-33 adds `.pdf`), one `scripts/lib/static-server.js`, about 40, with the two tooling boot waits (card-walk.js:32, persona-driver.js:418) beside it. **CSS:** 16 dead classes (`delete-btn`, `form-group-center`, the three `grid-*-row`, `header-type-icon`, the three `line-drop-adj-btn--*`, `line-type-settings-section-header`, `page-info-label`, `settings-advanced-buttons`, `settings-primary-btn`, `summary-derived-heading`, `duct-create-row`, `duct-schedule-design-row`) and 22 re-declared selectors, up from 14 (one new, `.quick-key-cap` at styles.css:1106 and 1112; a tail block at 2740-2775 re-declares twelve selectors first declared between 720 and 1489); fold and delete, check in the Modal Gallery, and keep the audit script as a node test with a ceiling. **The doc sweep, what is left** (PR #284 fixed the line counts, the HOTKEYS pointer and the render-pixels sentence): six misnamed SECTION markers in app.js (`:243` holds the annotation-model wrappers, not "ICONS array"; `:642` holds the Save Status log helpers while `:733` "Save Status log & envelope" is 3 lines; `:1000` holds the IndexedDB backup and custom-icon wrappers; `:3272` has no colour picker; `:3680` holds the PDF buffer helpers; `:4085` holds the sidebar filter-scope setters), then `build:toc`; three stale eslint exemptions (eslint.config.js:337 `closePreparePdfModal`, 338 `hydrateProjectFromCloudRow`, 345 `openCopyProjectModalOrPromptSave`, all defined in feature files now) and the AGENTS.md sentence at 376-377 that names them plus `resetAutoRecheckoutCounter`; three app.js comments that still say "the HOTKEYS table (constants.js)" (6187, 6260, 6585); the punch rows ICON-STORE ("merges" should read "replaces": annotation-model.js:509 and 444 call `ctx.saveUserCustomIcons(d.customIconPaths)`, which overwrites the store wholesale at app.js:209-212, so opening a project with an empty list empties it) and MAP-PERMS (the T27 sizes). A rulebook nit for the same sweep: the last map said thirty HVAC rule pointers; it is 28 of 37.

## 2. Defects

Confirmed means reproduced by running code. Read means read in code at `65f712f` and not executed. Bugs have PUNCHLIST rows (Q07's is added with this map).

| # | Severity | Check | Where | Defect |
|---:|---|---|---|---|
| Q01 | bug | confirmed | `water-model.js:396` | Two water runs leaving one point each get both loads (T05). Was N01. |
| Q02 | bug | confirmed | `duct-model.js:1223`, `water-model.js:396` | Runs drawn head to tail are each the other's child: designed CFM 0, no static path, two taps (T02). Both networks accept a 3-cycle. |
| Q03 | bug | confirmed | `idb.js:141, 209` | A re-put at the cap evicts a neighbour; a re-put of the oldest over the byte cap stops eviction early (T03). Was N18, read. |
| Q04 | bug, cosmetic | confirmed (string half) | `features/tutorial.js:1381` | A chip whose label carries a quote finds no control; ten cards (T04). |
| Q05 | test | read | `lessons.spec.js:210` | The undo card's click races the engine's 60 ms focus timer (T01, FLAKE-START-UNDO). |
| Q06 | bug | read | `features/duct-tool.js:411` | The first-run toast names an assignment no surface can make (T28, after DUCT-RUN-SYSTEM). Was N07. |
| Q07 | bug, cosmetic | read, fixed | `app.js:5744` | Desktop Measure's band did not follow the mouse between the first and second click (T16). Was N08; MEASURE-BAND, closed 2026-09-28 with the one-line gate. |
| Q08 | latent | confirmed | `duct-model.js:1663` vs `1555`, `1416` | Two rules for which system a run belongs to (T02). Was N09. |
| Q09 | latent | confirmed | `water-model.js:438` vs `duct-model.js:1369` | The water draft counts a branch tapped behind the tip; the duct draft does not (T05). |
| Q10 | latent | read | `features/turn-in.js:83` | The manual Check Out has no timeout (T08). Was N13. |
| Q11 | latent | read | `features/bid-check.js:150` | A project with no trade gets an inconsistent Bid Check (T06). Was N14. |
| Q12 | latent | read | `features/counter.js:86, 484`, `choose-create-line-type.js:60`, `quick-modals.js:402`, `tag-reader.js:287, 296` | Feature-file arms skip `clearToolStarts`; a Measure crosshair rides under the counter (T19). Was N15, two sites added. |
| Q13 | latent | read | `features/project-settings.js:345` vs `save-engine.js:2926` | The two device-key lists differ, and neither is the "sign-out key list" AGENTS.md names (T09). Was N16. |
| Q14 | latent | read | `features/duct-tool.js:301` | The auto riser takes the first room box; Bid Check and the draft check take the smallest (T07). Was N17. |
| Q15 | latent | read | `features/drop-mode.js:114` | The Drop overlay is sized by the device pixel ratio, not the clamped one (T28). Was N19. |
| Q16 | latent | read | `render-worker.js:114` | The worker's PDF options are a hand copy of `PDF_OPEN_OPTIONS` (T28). Was N20. |
| Q17 | latent | read | `sw.js:488, 467` | A sample PDF regenerated alone goes stale inside a cache version; view-link URLs with tokens are cache keys (T28). Was N21. |
| Q18 | latent | read | `duct-model.js:2031, 2313, 2347` | Generic top-level names in the shared scope (T24). Was N22. |
| Q19 | latent | read | `rules.test.js:29` | A course-only applied rule passes with no card naming it (none does today); 18 card-named rules lack `course`, which may be by the `course` definition at scripts/lib/rules.js:57 ("only the courses apply"). Decide what the chip means, then pin it. Was N23. |
| Q20 | latent | read | `app.js:4470, 4553, 4605` | Block-declared functions reached from the registry (T20, T21). Was N24. |
| Q21 | latent | read | `index.html:77, 682` | The landing's hand copy of the site chrome: three extra nav links and no `site-header-wrap` in the header, a city and phone but no family line in the footer, against scripts/lib/site.js:67-90. Was N25. |
| Q22 | latent, low | read | `features/save-project.js:183`, `prepare-pdf.js:620` | A teaching-set name is refused by Rename and accepted by Save and Prepare PDF (T10). |
| Q23 | latent, low | read | `features/quick-keys.js:34` | Two copies of the number-row order (T28). |
| Q24 | latent, low | read | `annotation-model.js:509, 444` | Opening a project replaces the user's icon store wholesale (punch row ICON-STORE, whose "merges" is the wrong word). |

Verified fixed since the last map: N02 (XSS-COLOR), N03 and N10 (BUNDLE-ONE-SHEET), N04 and N05 (ESC-STACK), N06 (CI-MAIN), N11 (TOUR-RESTART), N12 (REAPPLY-DUCT), N26 (XSS-COLOR, with Q04 as its ripple).

## 3. Cross-cutting patterns

- **A fix lands on one copy of a twin.** Still the commonest shape: the water draft keeps the behind-the-tip rule the duct draft dropped (Q09); the riser reads the room one way and Bid Check another (Q14); the sibling guard reached duct and not water (Q01). After a fix, search for the twin, and for the rule the twin's neighbour changed last week.
- **A helper is exported and copied the next day.** `lessonKit.onTouch` went out on 2026-09-27 and five course cards wrote `matchMedia` by hand on the 27th and 28th (T13); `App.collapsePagesSectionForPlacing` is published and copied five times (T19). Publishing a helper does not stop the copies; a grep test does.
- **The engine grows, not the content.** Of tutorial.js's +444 this window, +315 is engine and the placement code now carries three corner lists and three overlap tests (T14). Card work lands in the engine when the engine has no pure half to land it in.
- **Pure logic only Playwright can reach.** Card placement, the duct bid weight, the Bid Check gate, the report's builders (which the XSS sweep changed unseen), `hitTest`. Each is a node test waiting for a pure function (T14, T15, T25, T26).
- **Hand-kept lists that could be derived.** Tool input (T16), teaching files and text keys (T12), device keys (T09), `SLOTS` (Q23), `SECTION_RE` (T28), the rulebook's `course` surface (Q19).
- **A rule in AGENTS.md held when a helper made it easy, and broke when it did not.** The two specs added this window pasted no boot wait (T11); the touch rule had no kit entry and broke five times (T13).
- **A spec races the engine's own timer.** T01 is the shape: the engine defers a move by 60 ms and the spec reads the screen before it. Wait on the engine's own "still" signal, never on a guess.
- **The tooling re-implements itself.** Four static servers, four boot-wait variants, two AST readers that now disagree three ways (T12, T28).

## 4. Sequencing

- **0. Defects** (T01, T02, T03, T04, T07, T08, T09, T10): each with its spec or node test; T02 and T03 are the two "read" items the last map carried that ran red this time.
- **1. Decisions** (T05, T06): two product calls, each blocking a build; T05's table is the brief.
- **2. Make the rest cheap** (T11's ratchet, T12, T13): the counting tests, before any large move in the teaching layer.
- **3. Pins** (T14's test, T15's golden test, T26): tests before the code they pin moves.
- **4. Dedupes** (T16, T17, T18, T19, T25, T28).
- **5. Moves** (T20, T21, T22, T23, T24): T22 before T23; the collision check before T24.
- **Dated:** T27 on or after 2026-10-04.
- **Last:** the doc sweep in T28, then, if the input sections start to churn, the gesture core.

## 5. Leave alone

- **app/index.html, styles.css**: single documents by necessity. Fold the 22 overrides and delete the 16 dead classes inside them (T28).
- **save-engine.js as one file**: one factory whose variables are shared engine-wide; the permissions classifier (918-1110) has 21 node tests. Dedupe only (T18).
- **annotation-model.js, idb.js, water-model.js, the trade pure models**: cohesive and node-tested; T03 is a ten-line fix inside idb.js, T05 a rule decision.
- **duct-model.js's tap topology core** (`:1068-1100`, `:1223-1264`) and the fitting inference (`:743-1024`): one rule shared by the fittings walk and the network. Fix the loop inside it (T02), do not move it. duct-model.test.js (2,247 lines) pins 111 of 129 exports; add cases, do not restructure.
- **canvas-draw.js, canvas-legend.js, pdf-bundle.js, the raster layer**: unchanged since R24 and R25; BUNDLE-ONE-SHEET left pdf-bundle.js one pipeline; legend-face readiness is handled in one place.
- **report.js as one file**: it holds the `window.*` contract; T26 adds exports and moves nothing.
- **features/esc-ladder.js** (199 lines after ESC-STACK): one `CLOSERS` map, one popover list, one tool table. Done.
- **quick-keys-model.js**: the model for how a dialog's pure half should look (no state, no DOM, a footer, 14 cases).
- **Lesson and course content** (`LESSONS`, the three `CHAPTERS` literals): content, governed by the card pass and the owners' list. The file around `LESSONS` is T22.
- **tour-blank.js, learn-words.js, learn-taps.js, scripts/card-walk.js**: cohesive; the touch copies in tour-blank.js go with T13, the `nameRe` pin with T12.
- **The order of updateUI's guarded hooks** (the comment at app.js:2805 says why): load-bearing.
- **The keydown handler, the registry, the boot sequence, zoom and the aim loupe, `showModal`/`hideModal`** (now the one home of the z stack).
- **hitTest's rung order** (markers, fittings, verticals, lines, legend, highlights, zones, rooms, notes): product behaviour. It could move whole into a pure `hitTestCore(pos, r, ann, env)` with a text measurer in `env`; still no node test, five callers all in app.js. Not ranked until the sections around it churn.
- **playwright.config.js, ci.yml**: landed a day ago and pinned by playwright-config.test.js; `fullyParallel: false` is why the shards split by file.
- **features/bid-check.js, duct-tool.js, duct-fittings.js, duct-schedule.js, output.js, room-sizer.js as files**: dedupe inside them.
- **persona-driver.js `installHelpers`**: shipped into the page, so it stays one function.
- **The films' camera blocks in build-hero-video.js**: each is one film's tuned sequence; a helper would hide the timing.

## 6. The skeleton's blind spots

Carried from the last map and still true: near-duplicates that differ by a renamed local; seam modules' `ctx.` and `deps.` coupling; big top-level literals; spec pinning by file name only; load-time reads through an alias (D38); no cross-script top-level name table (T24); a name only tooling reads never enters the registry; it does not read eslint.config.js; tests that pin a fallback look like tests that pin the feature (T27); closure variables shared between functions are not shown. New this run:

- **A registry name read by string never enters the graph.** report.js reads `getDuctScheduleForReport`, `getWaterScheduleForReport`, `buildWaterCopyRows` and `buildWaterReportHtml` through `appRollup('…')` and `appBuild('…')` (report.js:142, 144, 174, 441), so the "read by nothing" list names four live seams. Same-file `App.*` reads and a cross-frame `contentWindow.App` read (modal-gallery.js:369) are also counted as unread. Five of the fifteen on the list are dead (T28); the list needs a string-read pass before it is trusted.
- **Dead exports of pure modules are invisible.** The 7.4 agent computed them by hand over the 142 shell scripts (two dead, four test-only in duct-model.js); a dead-export step for pure modules would pin it.
- **It does not read styles.css**, so dead classes and re-declared selectors are hand counts; the audit is about 40 lines and could be a `css` section.
- **The 8-line near-duplicate floor hides the copies that drift fastest here**: the boot waits, the `TYPES` map, `termRe`, `matchMedia`. A per-spec shape table (boot wait, weak boot, upload, collector, helper import) would host T11's ceilings and show the six half-migrated files.

## 7. By area

The agents' full reports, with every file:line, are not committed; the findings above are their substance. One line per area:

- **7.1 app.js render and UI**: nothing moved since `3eb45a9` except the bundle buttons out and the z stack in. `renderAnnotationsInner` (392) and `hitTest` (154) untouched, still untested. T19 (about 310, two more twins found), T20 (spec first), T17.
- **7.2 app.js input, hotkeys, registry, boot**: S06 landed (ESC-STACK); Quick Keys grew a pure model the right way; the input sections did not churn, so the gesture core (1,274 lines) still waits on T16, whose rect half is now only the six click branches; Q07 stays open and gets its punch row; five dead registrations to delete.
- **7.3 Tours, Learn, courses**: the card pass grew the engine (+315 of tutorial.js's +444), not the tours; placement now carries three corner lists and three overlap tests; one touch test is written in seven places. T14 (about 250 pure lines), T22, T23 open; S07 landed; N26 fixed with one ripple (a quoted chip goes dead, T04).
- **7.4 HVAC duct**: unchanged since the last map and every citation holds; the model is sound, and its two confirmed defects (the two system rules, the head-to-tail tap loop) are both inside `ductChildLinks`'s rule and fix together (T02). T15, T24.
- **7.5 Electrical, water, Bid Check, rulebook**: no split needed for size. The plumbing tour leans on two water rules the duct twin already changed (siblings off one point, the branch behind the tip), so T05 is a call on the tour's trace direction as much as on the model; T06 waits on TRADE-DEFAULT; T25 is half a delegate away, about 65 lines.
- **7.6 Lifecycle, cloud, sharing**: sound. S08 landed; T18 and T21 unchanged, recipes hold. Q03 confirmed in node (three shapes); Q10 and Q13 open; the rename landed clean but its sample-name guard has two unguarded doors (T10). T27 is one test-helper default plus about 40 engine lines. R1-FLIP waits on R1-TEST.
- **7.7 Drawing, rasters, report, output**: S05 landed as written and the buttons left app.js; one raster pipeline, verified again. T17, T26 open; Q15, Q16, Q17 open with lines moved. New: the scale line drawn twice in app.js (T19); `ductDistToPolyline` is dead too.
- **7.8 Shell, CSS, tooling, specs**: S03 and S04 landed and pinned; T11 did not move (251 / 240 / 184 / 222, the helper in 28 of 191) but the two new specs kept the rule; T12's two readers drifted further (title, decls, ABBREV); Q21 untouched. T11, T12, the CSS fold; FLAKE-START-UNDO is a 60 ms timer the spec can wait on (T01).

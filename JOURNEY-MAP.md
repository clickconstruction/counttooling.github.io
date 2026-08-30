# Journey Map — every route through the app

The UX counterpart to [DECOMPOSITION_MAP.md](DECOMPOSITION_MAP.md): a single decision
document for making CountTooling **easy to understand for most users** while keeping the
spirit of a simple Mechanical/Electrical/Plumbing counting and takeoff tool. The organizing
unit is the **journey** — a route a real user takes to get something done — not the feature.
Every audit, verdict, and improvement hangs off a journey.

The dossiers in `journeys/` double as a knowledge base once complete, feed guide
refinements (the per-article recipe in [GUIDES-PLAN.md](GUIDES-PLAN.md) starts with
"verify in the app first" — a dossier IS that verification), and each carries a
**demo moment** note so the same material powers sales narratives later.

> **STATUS 2026-08-02:** Phase 0 (this frame) done. **Phase 1 done** — 19-agent
> ground-truth workflow (surface inventory, 17 journey cross-indexes, coverage critic)
> + the production telemetry baseline. Outputs: seed dossiers in `journeys/` (all 17 ◐),
> [journeys/_surfaces.md](journeys/_surfaces.md) (71 modals, full entry-point inventory),
> [journeys/_coverage.md](journeys/_coverage.md), and
> [journeys/_telemetry-2026-08.md](journeys/_telemetry-2026-08.md). Phase-1 findings below.
> **Phase 2a COMPLETE 2026-08-03** — all 18 journeys walked (finished sequentially,
> one agent at a time, after Will's token-flow call; app updated to origin/main
> 6f3d75e first). **158 walker-reported findings: 17 blockers, 60 stumbles,
> 81 papercuts**; 202 proposals (22 rework / 86 polish / 56 keep / 26 teach /
> 7 hide / 5 gap); 88 duplicate-surface moments; 115 not-walked items (mostly the
> cloud interiors, per the no-cloud rule). Recurring blocker THEMES for 2b to
> verify first: (a) signed-out data-loss cluster — restore prompt gated behind
> sign-in while the 5s backup interval overwrites yesterday's backup on an empty
> boot (J4/J12/J15); (b) Set Scale modal structurally clipped at ≤900px-tall
> viewports, two-point tab unreachable (J3/J6/J7); (c) px+ft summed under a "ft"
> label — Copy Summary skips the scale check, all rollups on unscaled pages
> (J11/J18); (d) arc line types under-measure ~4–5%, shorter than their own chord
> (J5); (e) rooms-only takeoffs can't reach any export (J7); (f) append-upload
> silently renames the project (J2); (g) Load-from-Cloud orphans placed marks
> (J16); (h) scale-zone presets skip the sheet-size correction (J6, NEW code).
> **Phase 2b COMPLETE 2026-08-09** — 18 adversarial verifiers ran sequentially,
> blocker-priority order. Verdict: **152 findings CONFIRMED, 5 downgraded, only
> 3 killed; 121 reproduced live** in the running app (most with exact numbers,
> file:line mechanisms, and counter-evidence hunts). **All 17 blockers survived**
> — the data-loss cluster reproduced *worse* than reported (backup poisoned to
> {markers:0} at t+5.3s), the Set Scale clip confirmed at three journeys, the
> arc under-measure, px+ft sums, rooms-only export gate, append-rename,
> load-from-cloud orphaning, and zone-preset correction skip all stand.
> Verifiers also surfaced NEW bugs in passing (canvas `strokeStyle='var(--red)'`
> invalid → stale rubber-band color, app.js:1793; toast modals painting beneath
> equal-z-index modals so error toasts are invisible, e.g. room-height
> validation). J6's addendum covered the post-walk scale-zone-settings modal
> (papercut-grade; doesn't alter zone findings). Every dossier now carries
> per-finding verdict stamps + a Verification section.
> **Phase 3 COMPLETE 2026-08-09** — 152 confirmed findings deduped into the
> 73-row ranked shortlist below (critic-audited, all six checks passed).
> Will's Tier-1 #7 decision 2026-08-09: zones inherit the sheet correction.
> **Phase 4 COMPLETE 2026-08-10** — nine self-contained plans of record in
> [journeys/plans/](journeys/plans/) (T1-01…T1-12; #3/#10 skipped as fixes in
> flight) + [journeys/plans/_INDEX.md](journeys/plans/_INDEX.md) with the
> execution order **T1-01 → T1-08 → T1-06 → T1-05 → T1-04 → T1-07 → T1-09 →
> T1-12 → T1-11** and the conflict ledger (scale.js apply-handler pair, the
> pdf-intake interleave, the render-pixels baseline single-regen rule, and the
> cross-cutting `log_user_event` allowlist-migration chain — each later
> migration must copy the then-latest deployed body). Execution is Phase 4's
> tail: one plan per one-topic branch, strictly sequential, `npm run check`
> before every merge, this table's status column flipped as each lands.
> Phase 5 (guide edits from Tier 4 + VALUE-NARRATIVES.md) can run anytime.
> **2026-08-17 — Project Settings composition audit** (off-journey surface
> audit of `settingsModal` + `settingsAdvancedModal`; the journeys all pass
> *through* the hub but never judged its composition). Net-new findings:
> Tier-2 #29 (Manage Icons buried under Advanced) + batch B18 (duplicate
> Advanced "Export PDF", Export Canvas as Advanced's yellow primary,
> three-verb save label, "macros" link naming). One candidate finding was
> retracted on verification: the locked groups toggle already ships
> `disabled` + explanatory tooltip (app.js `updateUI`, styles.css :disabled
> rule). B18's shipped items landed 2026-08-17.

---

## The spirit test

Every proposed change must pass ALL four, or it dies in synthesis:

1. **Fewer steps or fewer decisions** on the trade user's happy path — not just different ones.
2. **Trade language, not software language** ("sheet", "run", "fixture", "bid" — not
   "canvas entity", "annotation object").
3. **A simplicity budget** — the proposal states what it *removes or makes unnecessary*.
   A proposal that only adds surface is rejected by construction.
4. **Findable by a plumber who has never read a guide.** If the answer is "it's in the
   docs", the verdict is `teach`, not a UI change.

## Verdict vocabulary

| Verdict | Meaning |
|---|---|
| **keep** | Already simple — document it as-is (dossier → knowledge base / guide / sales) |
| **polish** | Small affordance, label, default, or empty-state change |
| **rework** | The flow itself needs restructuring |
| **teach** | App is fine; the guide, an in-app hint, or onboarding must carry it |
| **hide** | Confusing surface for most users — demote behind Advanced / right-click |
| **gap** | A route users expect that does not exist |

Friction severity: **blocker** (users stop / do it wrong) · **stumble** (users recover
but lose time or confidence) · **papercut** (annoyance; costs polish, not outcomes).

## Personas

| Code | Persona | What they're doing |
|---|---|---|
| P | Plumbing estimator | The core user — daily takeoffs, palette standards, PipeTooling handoff |
| E | Electrical estimator | Devices/fixtures by schedule mark, conduit runs + drops, panels as groups |
| H | HVAC estimator | The growth track — Room Sizer today; duct-by-size is the known #1 gap |
| F | Field / tablet user | Touch, offline, aim loupe, install — basements with no signal |
| V | View-link recipient | A GC/owner/inspector with a `?t=` link — no account; **this journey is the sales funnel** |
| N | Brand-new user | The first 10 minutes — the make-or-break journey |
| T | Team collaborator | Sharing, checkout/turn-in, "who has the project" |
| A | Admin | Onboards estimators, transfers ownership, audits activity |

## Journey inventory

17 journeys. Status: ☐ not started · ◐ dossier drafted · ● dossier verified (walked in the app).

| # | Slug | Journey | Personas |
|---|---|---|---|
| J1 | `first-plan-to-first-count` | Land in the app cold → PDF loaded → first counter placed | N |
| J2 | `trim-and-organize-a-bid-set` | 200-sheet combined set → just my sheets, named my way | P E H |
| J3 | `set-a-scale-you-can-trust` | Calibrate a sheet: two-point / preset / custom; correction, verify, scale bar | P E H |
| J4 | `count-fixtures` | Build the counter palette (Quick Count / icons / groups) and count | P E |
| J5 | `measure-runs` | Lines, polylines, arcs, drops, 45° snap — LF that's actually right | P E |
| J6 | `multi-scale-and-repeats` | Details/isos at other scales (scale zones); typical floors (multiply zones) | P E |
| J7 | `hvac-room-sizing` | Room boxes + heights → ft²/ft³ for equipment sizing | H |
| J8 | `annotate-and-review` | Highlights, notes, legend, hide-marks, layers + peek | P T |
| J9 | `fix-mistakes` | Undo, Delete Area, context menus, item details, line properties | P E H |
| J10 | `produce-deliverables` | Report, Export PDFs, download page — the thing you send | P |
| J11 | `hand-off-to-pricing` | Copy to PipeTooling (+ scale check), Copy Summary | P |
| J12 | `save-load-return` | Autosave trust, Save Status bell, restore-last-session, Load Project | P F |
| J13 | `share-and-collaborate` | Roles, checkout/turn-in, expiry recovery — one editor at a time | T |
| J14 | `share-with-an-outsider` | Create/send a view link; the recipient's entire experience | V P |
| J15 | `field-tablet-offline` | Install, go offline, touch + aim loupe, come back online | F |
| J16 | `reuse-standards-across-bids` | Artboard, Palette Insights, Quick Keys riding the artboard, icon library | P E H |
| J17 | `admin-onboards-a-team` | Create users, passwords, transfer, activity, force turn-in | A |
| J18 | `prove-the-number` *(added from the Phase-1 coverage critic, approved 2026-08-02)* | Double-check counts before sending the bid: Summary drill-down w/ thumbnails, footer totals, mid-takeoff page rotation | P E H |

## Phase 1 findings (2026-08-02)

- **Coverage is dense but not total**: 60 of 64 FEATURES.md features are claimed by at
  least one journey. Orphans: *Page rotation (R)* (mid-takeoff, distinct from
  Prepare-time), *Background page warm-up*, *Keyboard Map*, *Summary panel + count
  detail*. (FEATURES.md has 64 bullets, not the oft-quoted 65 — reconcile.)
- **Blind spots the critic named**: (1) no "prove the number before sending" audit
  route → proposed J18; (2) no journey shows a new user *discovering* the shortcut
  surface (Keyboard Map / right-click settings) — fold into J1's Phase-2 walk;
  (3) the desktop big-set performance experience (warm-up, cached zoom on a 40-pager)
  is observed by no journey — fold observation duties into J2/J5 walks.
- **Three cross-cutting themes** (features claimed by 3–5 journeys each) that deserve
  shared treatment in synthesis rather than per-journey fixes: **(a) scale
  correctness** (per-page scale, always-feet, zones), **(b) palette ergonomics**
  (Quick creators, Quick Keys, custom icons, right-click settings/context menus),
  **(c) sync-and-offline trust** (autosave, bell, offline, checkout, PipeTooling copy).
- **Telemetry** (full baseline in [journeys/_telemetry-2026-08.md](journeys/_telemetry-2026-08.md)):
  J5/J4 are the daily core; exports are rare and concentrated; J14 under-converts
  (107 links / 56 accesses); only 7 event kinds instrumented — J3/J6/J7/J11/J13/J15/J16
  are telemetry-blind, so Tier-1 reworks must ship with their own `logUserEvent`.
- **Surface scale** (full inventory in [journeys/_surfaces.md](journeys/_surfaces.md)):
  **71 modals**, ~30 header controls + full sidebar twins, 25 hotkey rows + the Quick
  Keys number row, right-click menus on marks *and* tool buttons, plus mobile-only
  surfaces (burger drawer, aim loupe). The sheer surface count is itself the
  simplification target — Phase 2 walks should note every moment two surfaces do the
  same job differently.

## Dossier template (`journeys/<slug>.md`)

```
# J<N> — <Title>
Personas · Trigger ("what just happened in the user's world")
## Current route        — numbered steps as actually walked; generated screenshots
                          (build-screenshots.js infra); step count + decision count
## Evidence             — telemetry weight (which events, how often), guide coverage,
                          spec coverage, entry points (header / sidebar / hotkey /
                          right-click / status bar / burger)
## Friction findings    — table: # · severity · what happens · why it hurts
## Proposals            — each with verdict + the four spirit-test answers
## Guide actions        — which article changes, what claim gets added/fixed
## Demo moment          — the ≤10-second thing that sells this journey
```

## Phases & review gates

| Phase | What | Scale | Gate |
|---|---|---|---|
| 0 | This frame: personas, inventory, spirit test, template | done inline | Will reviews the frame |
| 1 | **Ground truth**: per-journey cross-index of catalog / modals / hotkeys / guides / specs + a production telemetry baseline (read-only `user_activity` pull) | ~19 agents | Will reviews inventory + evidence |
| 2 | **The walks**: one persona-agent per journey drives the real app; adversarial verify pass kills findings/proposals that flunk the spirit test | ~2 agents/journey | Will reviews dossiers |
| 3 | **Synthesis**: dedupe cross-journey findings → ranked tiered shortlist written into this file | small | Will approves tiers |
| 4 | **Plans-of-record**: per Tier-1 item, the house shipping shape (branch, spec, docs rows, guide edit, build:sw) | per item | normal PR review |
| 5 | **Repurpose**: dossiers → knowledge base; guide edits; `VALUE-NARRATIVES.md` for sales | mostly free | — |

Note: this repo is the deployed public site, so dossiers are publicly readable — same
precedent as FEATURE-CATALOG.md's market analysis. Keep customer data out of dossiers.

## Ranked improvement shortlist

**Phase 3 synthesis, 2026-08-09.** Input: 100 verified finding+proposal pairs from all 18
dossiers (152 confirmed findings collapse to the rows below after cross-journey dedupe —
same root cause in N journeys = ONE item listing all N). Ranking inside Tier 1 is
(severity, journeys affected, telemetry weight); telemetry weighting per
[journeys/_telemetry-2026-08.md](journeys/_telemetry-2026-08.md) — **J5 measure-runs and
J4 count-fixtures are the daily core**; J3/J6/J7/J11/J13/J15/J16 are telemetry-blind, so
**every rework ships with its own `logUserEvent`** (standing rule). Status: ☐ queued ·
◐ fix in flight (Will's separate sessions) · protected strengths listed at the end.

### Tier 1 — correctness & data trust (loses work or produces wrong numbers)

| # | St | Item (journeys) | Evidence | Verified proposal | Effort | Telemetry |
|---|---|---|---|---|---|---|
| 1 | ☑ merged 2026-08-10 | **Signed-out return loses all work** — restore prompt gated inside the signed-in branch while a complete local backup (marks + PDF) sits in IndexedDB; re-uploading the same PDF restores 0 marks (J4 J12 J15) | app.js:6470 (gate), :6488 (offer); `takeoffBackupGet('local')` reads fine anonymously | Offer the "Project from Last Session" Keep/Discard prompt on signed-out boots AND re-apply pageCanvases at PDF re-open (J4's second half). Verified: full restore in 0.26s, fully offline, zero network | M | new `restore_prompt_shown` / `restore_keep` events (J12/J15 blind) |
| 2 | ☑ merged 2026-08-10 | **5s backup interval clobbers the unrestored backup** ~3.5–5.3s after boot — reproduced poisoned to `{markers:0}`; breaks signed-in Keep too (J12) | app.js:5952 (unconditional interval); restore-last-session.js:62-63 re-reads the clobbered record | Never overwrite an unrestored backup: key the boot backup aside until Keep/Discard (NOT a pages-empty skip — that drops pre-PDF palette backups). Ship in the same PR as #1 — Keep is poisoned without it | S | debug counter `backup_clobber_averted` |
| 3 | ☑ merged 2026-08-10 | **Set Scale modal (1109px) clips top+bottom at ≤900px viewports**, no scroll, two-point tab unreachable — walls off the correction trap's only escape hatch (J3 J6 J7) | styles.css:219 (85vh clamp is mobile-only) | Extend the mobile rule to desktop: max-height ~85vh, overflow-y auto, sticky tab row | S | add `scale_set` while in the file — the named cheapest blind spot |
| 4 | ☑ merged 2026-08-10 | **Preset/custom scale silently applies the sheet correction** — one preset click and a 65' wall reads 173' (×0.375); "don't correct" is last of 17 and not remembered; trap sits on J5's drawing happy path (J3 J5 J6 J7) | sheet-correction dropdown pre-selects ANSI D; correctionFactor 0.375 reproduced on J5's corridor (66.59 ft for a labeled 25 ft) | When a correction is in play, preset AND custom apply flow straight into the two-click on-plan verify (escapable — Esc/skip keeps the applied scale). Subsumes J6's at-apply warning polish and J3's custom-entry papercut | M | `scale_set` event carries correctionFactor + verify outcome |
| 5 | ☑ merged 2026-08-10 | **Pixels summed into feet** — unscaled-page runs (raw pts) roll into ft totals on footer/Summary/legend/report headline, and Copy Summary ships them: copied "401.20 ft" (true 74.80) with no scale check (J11 J18) | line-metrics.js:88-92; app.js:3036 (gate only checks at tool-arm — page-flip keeps placing); report.js:314-318 | Re-check the scale gate on page switch while a line tool is armed; rollups NEVER add px under a ft label (split px rows / ⚠ flag on all five surfaces — the Rooms section already ships the convention, report.js:408); gate Copy Summary with the existing unscaled-line check | M | new `copy_summary` + `unscaled_ft_block` events — the flagship handoff is currently invisible |
| 6 | ☑ merged 2026-08-10 | **Arc line types under-measure every run ~5%** — an arc measures shorter than its own chord (14.73 vs 15.30 ft) (J5, daily core) | geometry.js:91-99 — `t+=0.05` FP drift skips the final step | Iterate to t=1 inclusive (integer loop) + unit test arc ≥ chord; comment distToQuadraticBezier's clamp-saved twin loop so the pattern isn't re-propagated | S | none needed (line_added tracked); the arc≥chord node test is the guard |
| 7 | ☑ merged 2026-08-10 | **Zone presets skip the page's sheet correction** — corrected page (3.375 px/ft) vs raw zone (18 px/ft) disagree 2.67× on one sheet, no warning (J6) | features/scale.js — `// zone target: no sheet correction` (deliberate) | Carry correctionFactor into zone preset/custom applies + the same "as if printed on" note; two-point untouched. **Approved by Will 2026-08-09: carry the correction into zones** (the in-code skip is overridden by product decision) | M | fold into `scale_set` (zone flavor) |
| 8 | ☑ merged 2026-08-10 | **Uploading an addendum silently renames the open project** — fires even with currentProjectId set, marks dirty, autosave pushes the wrong name to the cloud (J2) | pdf-intake.js:347; save-engine.js:2469 | Never rename on append — guard line 347 as the code's own comment (pdf-intake.js:357-361) argues; toast "Added 2 sheets to \<project\>" | S | none (project_save exists); Playwright append-keeps-name case |
| 9 | ☑ merged 2026-08-10 | **Mid-bid "Load from Cloud" wholesale-replaces the palette** — 14 placed marks stay drawn but every tally reads 0; no reconcile, no undo snapshot (J16) | my-settings.js:65-87 | Name-match/re-link marks via `reconcileOrphanedCountersAndLineTypes` (already on 6 intake paths), warn in trade terms, push an undo snapshot | M | new `artboard_load` event (J16 blind) |
| 10 | ☑ merged 2026-08-10 | **Rooms-only takeoff dead-ends** — Show Report / Export PDFs / Copy Summary never appear though the report renders Room Volumes fine (J7) | report.js:334 — getPipeToolingHasData omits roomBoxes (report.js:269 renders them) | Include roomBoxes in the probe — the four buttons appear exactly where they already do for counts | S | add `report_open` opportunistically |
| 11 | ☑ merged 2026-08-10 | **Choose-tab count badges always read 0** — sums dead `p.annotations` from before the layers refactor; sidebar says 7/4/2 while Choose says 0/0/0, in the daily-core flow (J4) | counter.js:64 | Resum across `p.canvases[].annotations` (helper exists) — one-line fix removing a lying number | S | none |
| 12 | ☑ merged 2026-08-10 | **Dead/revoked view link drops the recipient into the full empty editor** after the email gate — transient toast is the only failure handling; the sales funnel's worst outcome (J14) | app.js:6391 | Full-screen plain message: "This plan link isn't active anymore. Ask the person who sent it for a new one." + Retry on network failure | S | new `view_link_dead` event — pairs with the 107-links/56-accesses under-conversion question |

### Tier 2 — high-traffic friction (confirmed stumbles on the daily core + cross-journey stumble clusters)

> **⚑ Stage-2 re-rank, 2026-08-30** (per [journeys/plans/_NEXT.md](journeys/plans/_NEXT.md);
> 20-day post-deploy telemetry: 0 client errors; counting is now the broadest daily
> activity — 622 marks/8 users vs 495 lines/6 users; `unscaled_ft_block` fired 36×
> for 2 users; restore Keep recovered real marks 25×; exports still rare).
> Execution order, grouped into PR-shaped units:
> **1.** #13 Clear Page (blocker-grade findability, S) ·
> **2.** #22 polyline Esc staging (the tier's one work-loss item, S) ·
> **3.** #25 hidden-marks hitTest (silent data mutation, S) ·
> **4.** #15 toast-system rework (platform fix — unblocks #23, the occluded
> room-height error, and the Distance hand-off; obstructed three Tier-1 builds; M) ·
> **5.** counter-modal cluster #17+#18+#19 as ONE branch (same surface, counting-core
> breadth, all S) ·
> **6.** #23 scale-gate toast→link (direct answer to the 36 blocks; builds on #15; S) ·
> **7.** #16 Quick Count icon/color dupes (S) ·
> **8.** #20 create-arms-the-tool (S) · **9.** #21 live length readout (S) ·
> **10.** #14 drag-gesture completion (M, 4 journeys) ·
> **11.** #24 raw-vs-multiplied labeling (M, trust-numbers) ·
> **12.** #28 polyline dialog tax (M) ·
> **13.** #29 Manage Icons re-home (S — ⚑ needs Will's placement call) ·
> **14.** #27 dblclick rename repair (S; trim/organize usage was light this window) ·
> **15.** #26 thumbnail-grid trim (L — last: biggest build, lowest current traffic;
> ⚑ Will confirms it stays in scope vs. deferring).

| # | St | Item (journeys) | Evidence | Verified proposal | Effort | Telemetry |
|---|---|---|---|---|---|---|
| 13 | ☑ merged 2026-08-30 | Clear Page unreachable — header button CSS-killed, sidebar rule dead; only route is Project Settings, sign-in-gated on desktop (J9, blocker-grade gap) | styles.css:474 (`!important` kill), :372 (dead rule) | Un-dead the sidebar button (delete the stale display:none) and/or "Clear this page" in the pages row | S | none |
| 14 | ☑ merged 2026-08-30 (band color 2026-08-10) | Rectangle tools ignore drag — press-drag-release arms corner 1 at release; the next stray click completes an unintended zone / highlight / 0'×0' room box (J6 J7 J8 J9). Rubber-band's invalid `strokeStyle 'var(--red)'` (app.js:1793, still live) is the in-flight half — not re-queued in the proposal | app.js:4588 (highlight), :4668-79 (room box, no min-size guard), :1789/:1793 (delete-area band) | One shared gesture: drag past a threshold completes the rectangle, two-click stays for touch; refuse the dialog for ~zero-size boxes; must coexist with the 280ms aim loupe | M | temp `rect_drag_complete` debug event during bake-in |
| 15 | ☑ merged 2026-08-30 | Toasts are full-screen click-swallowing overlays AND paint behind equal-z-index modals — "Distance:" eats the measure→zone hand-off for 5s; room-height validation invisible behind roomBoxModal (J3 J6 J7) | styles.css:475 (fixed inset:0, z-200); room-sizer.js:248 (occluded toast) | Non-blocking corner toasts with pointer-events:none (deletes the modal-overlay behavior app-wide) + fix toast stacking; move the Distance readout to a footer chip / cursor tag | M | none |
| 16 | ☑ merged 2026-08-30 | Quick Count counters silently inherit first library icon + default yellow — "0.5in PEX Tee" marks render identical to Water Closet; error surfaces at pricing time (J4) | quick-modals create path ('?' box untouched) | Per-Type default icon (valve/elbow) or rotate the color when icon+color would duplicate an existing counter; must carry custom types | S | counter_marker_added exists |
| 17 | ☑ merged 2026-08-30 | Counter-create ergonomics cluster — C lands on the empty Choose tab; blank create mints a counter literally named "Counter"; "+ Add" prefills Water Closet unconditionally and mints identical twins that split tallies; empty state points at an off-screen button (J1 J4) | counter.js:59, :86, :113, :164 | Land C on the Create tab pre-filled (like + Add); prefill the next unused library icon's name; numbered suffix + rotated color for exact twins; reword the empty state to "No counters yet — use the Create tab above." | S | none |
| 18 | ☑ merged 2026-08-30 | Create-tab icon search permanently hidden — ships inline display:none with a live handler; the guide promises a search that never appears (J4) | index.html:587; counter.js:145 (live handler) | Remove the attribute — one deletion; also makes custom-icons.md truthful for free | S | none |
| 19 | ☑ merged 2026-08-30 | Custom-SVG upload success is invisible — icon appended selected-but-below the 200px grid fold; the modal looks pixel-identical, reads as a no-op (J4) | custom-icon-upload.js (no scrollIntoView/toast; cell lands 308px down, scrollTop 0) | Scroll the grid to the new icon and flash its selection ring | S | none |
| 20 | ☑ merged 2026-08-30 | "Create = pen in hand" — 3 of 4 line-type create surfaces leave you in Move; +Add never arms; the polyline modal's "Create new line type" link is dead; Quick Line re-opens the chooser even with one type (J5 J9) | choose-create-line-type.js:105 (the one surface that arms); app.js:3217, :3035; index.html:712 (dead link) | Every create surface arms the drawing tool; wire or remove the dead link; skip re-choose at one type | S | line_added exists |
| 21 | ☑ merged 2026-08-30 | No live length while drawing — footer only says "Tap end point"; totals appear post-commit; per-line labels are opt-in via right-click (J5) | footer coaching slot | Show running length (feet-inches, like the Measure toast) in the footer slot that already coaches — zero new chrome | S | none |
| 22 | ☑ merged 2026-08-30 | One Esc mid-polyline silently discards ALL clicked vertices — a stray Esc fifteen vertices into a waste main erases the trace (Quick Line already stages Esc) (J5) | polyline Esc path | Stage Esc like Quick Line: first removes the last vertex, second exits | S | none |
| 23 | ☑ merged 2026-08-30 | "Set Scale ⚖ first…" gate toast names the fix but isn't a link, auto-dismisses ~2.5s, and Set Scale is an unlabeled icon to hover-hunt (J5 J6) | app.js:2631-39 (plain text, weight 400) | Make the toast's "Set Scale" text actually open the Set Scale modal | S | none |
| 24 | ☑ merged 2026-08-30 | Raw vs multiplied counts disagree inside one sidebar — COUNTERS 7 vs SUMMARY [13]; badge 9 vs Summary 11 — nothing labeled either way, anywhere (J6 J18) | sidebar-lists.js:47 (raw sum) vs summary-list.js:112 (zone-multiplied) | One multiply-adjusted arithmetic everywhere + trade words ("7 placed" / "13 with repeats", optionally "5 ×3"); must cover show-only-current-page mode (sidebar-lists.js:39) | M | none |
| 25 | ☑ merged 2026-08-30 | Hidden marks still catch the mouse — hide-marks clears paint but not hitTest; a silent 32pt note move persisted after re-show (J8) | app.js:1560 vs :5020 | Early `if (state.hideMarks) return null` in hitTest — covers notes, legend, and context menus alike | S | none |
| 26 | ☐ | Trimming a 200-sheet set is strictly one-sheet-at-a-time — ~185 clicks to reach a 15-sheet P-set; fatigue defeats the feature (J2) | features/prepare-pdf.js (only Prev/Next/Delete/Undo/Rotate exist) | Thumbnail-grid trim with tap-to-keep/drop, single-sheet preview for zoom — must REPLACE the sheet walk as default, not sit beside it (largest build in this set) | L | new `prepare_trim` event |
| 27 | ☐ | Double-click sheet rename is dead — row onclick → fitZoom → renderPagesList innerHTML rebuild destroys the node before the second click; the working badge-click path is advertised only by a hover tooltip (J2) | sidebar renderPagesList rebuild race | Skip the rebuild when the clicked row is already active / defer past the dblclick window — repairs the affordance with zero new UI | S | none |
| 28 | ☑ merged 2026-08-30 | Polyline dialog tax — every polyline requires the New Polyline round-trip and finishing drops to Move; with zero line types, "—" + Start Drawing commits `lineTypeId:null` and the footage seems to vanish into Lines → Unassigned (J5) | New Polyline dialog path; null-commit repro | When a line type is active, P starts drawing immediately (auto-name, same color; dialog reachable for the rest); block Start Drawing on "—" reusing the picker's empty-state copy | M | none |
| 29 | ☐ | **Manage Icons is buried under Advanced** — custom icons are a flagship, guided feature (J4; CUSTOM_ICONS.md, custom-icons guide) whose only settings route sits behind a word that tells trade users "don't touch"; findability fail by construction (2026-08-17 composition audit) | app/index.html `settingsAdvancedModal` (#advancedManageIcons); count-fixtures.md:28 walked the burial | Re-home the opener on the counter/palette surface (e.g. the Create-tab / manage-icons row) — needs a placement call; Advanced keeps repair/cache tools only | S | none |

### Tier 3 — polish & papercuts (batched by surface so they ship as few PRs)

| # | Surface / files | Batch contents (journeys) |
|---|---|---|
| B1 | app.js Esc ladder (:5775+) | One PR of else-if rows: saveStatusModal + lastSessionRestoreModal (J12 — re-homed from its teach verdict), the 5 counter dialogs + backdrop-close (J4), paletteInsightsModal (J16), legendSettingsModal (J8), mark #contextMenu mirroring tool-context-menu.js:112's capture-phase handler (J9) |
| B2 | pdf-intake.js + import-clear.js | Intake/import feedback: corrupt-PDF message on the fresh path — currently silent unhandled rejection vs the append path's alert (J2); "Added N sheets" append toast (J2); alert→in-app toast for bad import files with a pointer to Export Canvas (J12); "Applied marks to 1 of 2 pages…" partial-import toast (J10) |
| B3 | features/output.js | Copy cluster: plain-words clipboard failure copy (J11); viewer-toast branch order — check loadedViaViewLink before session, un-deadens the accurate branch (output.js:80-86, J11 J13); anchor the scope drop-up to its button (`right:auto`) + the two copy menus close each other (J11); resume / one-tap "Copy again" after the Set-scale detour, re-running collectUnscaledLinePages inside a user gesture (J11); skip the scope chooser at 1 page/1 canvas like the Download button already does (output.js:416-17, J13) |
| B4 | Export naming & scope dialect | Cloud-menu "Export PDF" → "Original PDF (no marks)" — kills the wrong-file-to-GC trap (J10); "Print …" entries → "Download …" (J10); one trade dialect across all three scope menus ("This sheet / Every sheet / Everything", drop "Canvas" when every page has one canvas) (J10 J13 J18); demote Copy to /Tooling to neighbor weight, make Export PDFs the yellow primary — also the adjacent fix for J13's external-link misclicks (J10 J13); grey the disabled Download button (J10); "Show Highlights/Notes" → "Highlight Pages (PDF)" / "Note Pages (PDF)" incl. the jsPDF fallback alert (J8) |
| B5 | pdf-bundle pagination | Keep report table rows together across breaks, fold Notes Summary onto the first notes page, uniform note pages — invisible output fix (J10) |
| B6 | Viewer / share surface trim | Hide viewer Export Canvas/Both — app.js:2378-79 already hides an empty dropdown, so the menu leaves view sessions for free (J14, covers J13's complement papercut); hide Room Sizer in view sessions (J14); hide the Save Status bell for anonymous viewers — an engineering console shown to outsiders (J13 J14); show the existing "Viewing only" banner to anonymous view sessions (app.js:2238 branch exists, J13); plan name instead of hardcoded "document.pdf" (view-only.js:274 AND restore-last-session.js:102 — same root cause, J12 J14); email-gate Cancel → static "This plan needs your email — reload to try again" card instead of the empty editor (view-only.js:186-190, J13 J14); expand "View links ▶" by default (J14); wire the two hardcoded clickplumbing.com strings to VIEW_LINK_ALLOWED_DOMAINS (view-only.js:193, J14) |
| B7 | Sign-In wall & admin copy | "Sign in to open Project Settings." conditional subtitle (J16 J17); "Accounts are set up by your office admin." static line (J13); the landing's "New here? Call (512) 360-0599…" sentence on the wall (J17); plain copy for fetch exceptions instead of raw "Failed to fetch" (app.js:4096, J17); reopen the intended surface after sign-in (J16); rewrite the stale Add User / Manage Users subtitles + de-duplicate the four modal headings (index.html:1944-70, :2068-99, J17) |
| B8 | Scale modal small fixes | Feet field gets a real default "1", not a placeholder (J3); one no-plan gate for every entrance reusing "Open a plan first." (tool-context-menu.js:57) — never fake "Scale set" success at 0 pages (J3); zone tools stay armed after Apply with a visible armed hint — ship only with T2 #14 (J6) |
| B9 | Mobile / touch batch | Auto-close the drawer on tool pick / Create Counter — next action is always on the plan (J1 J15); right-pad the tool strip past the burger so no tool can rest under it (J15); zoom rail stays until dismissed — remove the invisible 5s timer (features/zoom-rail.js, J15); coarse-pointer copy swap ("Tap to place…"), hide ⇧Q chips and right-click tooltip suffixes on touch (status-bar.js:173, scale.js:152, J15) |
| B10 | Legend & proof surface | Don't draw the empty "No items" legend + mirror the gate in hitTest (canvas-draw.js:560-672, J8); legend hit order ahead of highlights — kills the accidental-pan surprise (app.js:1090 vs :1046, J8); fix the legend anchor post-rotation + right-edge row clipping (J18); Summary-heading tooltip says what click does ("Legend settings — ▼ collapses", J8); "this sheet" scope suffix in the legend header (J18); footer totals get inline words + click scrolls/flashes the Summary (J18); ignore R while the count-detail modal is open or re-render via the existing generation-token machinery (J18) |
| B11 | Signed-out save signal — ship WITH Tier-1 #1 | Status bar shows the local stamp it already tracks: "Saved on this device · 4:42 PM" (getLastLocalBackupAt in save-engine.js, J12); truthful panel copy "Saved on this device… Sign in to sync." (J12); together these cover J15's recorded save-indicator gap |
| B12 | Import Canvas menu row | Show it greyed with "(canvas has marks — clear or undo first)" instead of vanishing mid-recovery (app.js:2371-75, J12) |
| B13 | Reuse-standards naming | Unify "Analyze My Usage" / "Palette Insights" under one trade name — "My Standards — your most-used counters and lines across bids" (J16); single empty-state message, drop the contradicting per-list "at this threshold" lines when the RPC returned zero rows (palette-insights.js:185, :214, J16) |
| B14 | "Cannot be undone" honesty pass | Clear Artboard confirm → "Empty this project's counters and line types? Marks stay but stop counting. Undo brings counters and lines back." (J16); delete-layer confirm → "Undo brings it back." (canvas-layers.js:116 pushes a snapshot first, J8); "Clear Page" → "Remove all marks from this page's Main layer?" — the layer qualifier is load-bearing (J9) |
| B15 | Prepare-PDF batch | Open Prepare for signed-out fresh uploads, retitled "Trim your set" — trimming is purely local (pdf-intake.js:361 gate, J2); confirm before Escape/Cancel discards the upload ONLY when deletes/renames were made (J2); Undo jumps the preview to the restored sheet (J2) |
| B16 | Cold start | Accept drag-and-drop of a PDF (today it triggers browser-default navigation and replaces the app) + a quiet "Drop a plan here — or Upload PDF" hint in the empty black canvas (J1 ×2) |
| B17 | Dead-UI removal | Delete the PLUM quick-add rows with their bindings and viewerHideIds entries together, or boot throws (styles.css:266, quick-modals.js:14, app.js:2119, J1 J4); hide the modal-level "Search counters…" box on the Create/Quick tabs it doesn't filter (index.html:569-71, J4) |
| B18 | Project Settings & Advanced composition (2026-08-17 audit) | **Shipped 2026-08-17:** delete Advanced "Export PDF" — it called the identical `App.downloadProjectPdf()` as the main modal's "Download PDF" under a different name (app.js:4174 vs :4182); demote Export Canvas from Advanced's yellow primary — the loudest button was the marks-only-JSON wrong-file-to-GC trap B4 documents; retire the three-verb "Name / Upload / Save Project to Cloud" label (the save modal never uploads — it names and saves) for stateful "Save Project to Cloud"/"Save Changes" across settings/sidebar/header/modal-h2/turn-in toast; rename the settings "macros" link to "keyboard shortcuts" so the link matches the modal it opens. **Queued:** status-bar "keys"/"macros" dialect rename travels with B4's naming pass (drags working-faster-with-the-keyboard.md + its `[[macros]]` ICON_BTN chip along); whether the settings keyboard links hide on coarse pointers needs a product call — they're the ONLY route on phones, but tablets with paired keyboards genuinely use Quick Keys (B9 adjacency); the red Clear Page link's placement in the help-links row resolves with Tier-2 #13. **Verified-keep:** the locked groups toggle (disabled + tooltip already shipped); Advanced's remaining residents (Canvas Repair, Empty cache, Global force reload, dev Load test PDF) are correctly gated and genuinely advanced |

### Tier 4 — teach: the guide-edit list

18 teach verdicts survived verification (Phase-2a's raw 26 shrank in 2b: several were
re-homed — e.g. the J12 Esc item is code and moved to B1). Grouped into 11 edits:

| # | Guide / article | Edit (journeys) |
|---|---|---|
| G1 | reports-and-exports.md | Document the sidebar "Export PDFs" (batch dialog) vs dropdown "Export PDF" (quick download) split — don't rename under 7 daily users' muscle memory (J12); state when a view link can be included in Copy to /Tooling, matching B3's branch fix (J11) |
| G2 | verifying-your-scale.md | Two-point / Use-measured badges show the measured line, not a preset name — `label:null` is by design (features/scale.js:197, J3); what the "· ANSI D" readout suffix means + always verify a known dimension after a preset (J7) |
| G3 | Keyboard guide | List redo explicitly as Ctrl/Cmd+Shift+Z; alias Ctrl+Y only if the request recurs (J6) |
| G4 | fixing-mistakes.md (+ counting-with-counters.md:36 fix) | Name both room-box delete paths and that Ctrl+Z restores a ✕-deleted box (J7); FIX the false claim that marks are selected in Move mode and deleted — the real path is right-click → Delete (J9) |
| G5 | counting-with-counters.md / custom-icons.md | Settings → Advanced → Manage Icons requires sign-in — intended design, undocumented cost (J4); the Quick-tab "−" button edits your saved profile list, no confirm (J4) |
| G6 | preparing-a-plan-set.md | Badge color meanings (yellow number = scale set, yellow outline = has marks) + in-app title-attribute tooltips merged with the existing rename tooltip (J2); the header cloud-arrow's no-PDF file-picker fallthrough is a kindness — document, don't change (J1) |
| G7 | Tablet / offline guide | Aim loupe: "slide to aim, release to place" — the 44px offset is deliberate finger-occlusion design; a coach mark fails the budget (app.js:4793, J15) |
| G8 | Artboard guide | Name the carry-over boundary: counters/lines already follow you on this computer; signing in carries them to any device (J16) |
| G9 | Sharing guide | "Sharing starts after you sign in — Share lives in Project Settings / the sidebar icon (phone)"; a dead signed-out button fails the budget (J13); viewer Measure reads px until a scale is set — "Set the scale to read feet (S)" (J14) |
| G10 | Annotate / review guide | During the peek the sidebar totals stay on your active layer — the on-sheet legend shows the merge (J8); note handles: right edge = width, left edge = text size (cursor swap is the affordance, J8) |
| G11 | Admin guide | Locked out → your admin resets the password (pairs with B7's wall copy, J17) |

### Tier 5 — gaps (product candidates, not commitments)

The verified dossiers stamped 19 items `gap` (Phase-2a's raw count of 5 grew as verifiers
reclassified proposal-less findings). Two are promoted/subsumed above (Clear Page → #13;
signed-out save indicator → #1 + B11). The rest, strongest first:

| # | Gap (journeys) | Note |
|---|---|---|
| X1 | Zones can't be moved or resized; empty-rect Apply mints an invisible no-op zone that later blocks overlap placements (J6) | Strongest candidate: zone edit handles + min-size guard (the guard half ships in #14) |
| X2 | Mobile has no layers peek — no live way to see two layers together (J8) | Verified route exists: "Show all layers" row in the mobile layers menu reusing `state.showAllCanvases` — no new mode |
| X3 | Once a scale is set the toolbar Set Scale button hides; re-editing requires knowing the sidebar readout is clickable (J7) | Discoverability gap on the trust-critical surface |
| X4 | Every box of a multi-box room draws the full Name+L×W×H label — labels overlap and cover the plan's room names (J7) | Label once per room / leader lines — needs design |
| X5 | On-plan legend lands half off-canvas after fit-zoom at 1380px (J7) | Initial-placement clamp; relates to B10's anchor work |
| X6 | "All Visible Canvases" actually copies the ACTIVE layer per page — marks visibly on screen are excluded (6 copied while 11 showed) (J11) | Rename rejected as relabeling the lie; honest fix is "active layer" wording OR a semantics change — product decision |
| X7 | "Copy Summary (Email/Text)" renders below the external-links row, detached from its export siblings (J11) | Layout regroup with B4's weight pass |
| X8 | One feedback system — native alert() / confirm() / styled toast / auto-modal roulette across save, load, share, clipboard (J16 J11 J14) | Standardize on the in-app toast once #15 lands |
| X9 | Vertex edit splices the polyline out of annotations — totals visibly drop by its footage until Enter recommits (J5) | Cosmetic-but-alarming during edits |
| X10 | One Esc anywhere in scale pick/verify is a silent total exit — modal, points, message all gone (J3) | Borderline platform convention |
| X11 | Scale-only pages get the yellow badge but Shift+←/→ marked-nav skips them — pageHasAnyAnnotations has no scale branch (annotation-model.js:98, J3) | One-branch candidate if it bites again |
| X12 | Tally grammar "1 lines"; Create tab accepts an empty name and mints a type named "Line" (app.js:3218, quick-line.js:116, J5) | Fold into a future copy pass |
| X13 | Number-strip odd states: tooltip "0 of lines" (status-bar.js:191); ↻ enabled with no PDF and silently no-ops (J18) | Same copy pass |
| X14 | Esc closes the Export PDFs modal but not the Show Report / printer dropdowns (J10) | Click-away only; low stakes |
| X15 | The only in-app account surface is the 38×17px footer "Sign In" link; header account buttons permanently dead (J17) | Softened by the landing's front door; hide-dead-buttons was rejected as unsafe |
| X16 | Copy to /Tooling sits directly above the eye-catching PipeTooling/TakeoffTooling external links — first-timers leave the site (J13) | Adjacent fix queued in B4 (demote weight) |
| X17 | Success feedback splits by state (signed-out toast vs 1.5s click-swallowing "Copied" modal) — a re-copy within ~1.5s silently does nothing (J11) | Largely resolved by #15's non-blocking toasts |

### Protected strengths (verified `keep` — do not touch while shipping the above)

- **Keep-and-Open restore** — PDF + marks rebuilt from IndexedDB in ~0.26s fully offline; unlocking it (#1/#2) IS the J12 journey (J12).
- **Verify machinery** — "Expected 65' / reads 173' / Off by 166% — Use measured" one-click repair + refLine stamp; the reason the correction trap is recoverable (J3). #4 builds on it.
- **Two-click zones + live preview + totals-only multiplication** — 7→13 with the plan untouched, under 10s; no confirmation step (J6).
- **Room Size dialog + armed loop** — the best-designed stretch of the app; untouched (J7).
- **Quick Line chaining** — two clicks per run, instant tally, exact 45° snap; #21/#22 add to it without touching the core (J5).
- **Summary count-detail drill-down** — the crown jewel; its honest per-page "px" rows are the model for #5's rollup fix (J18).
- **Copy-to-/Tooling scale-check gate** — names the flagged page, jumps there, flips 401.20→74.80 in ten seconds; #5 extends it to Copy Summary rather than touching it (J11).
- **Core count loop** — empty app to 7 counted fixtures in 10 actions; count-aware delete confirm exactly right (J4).

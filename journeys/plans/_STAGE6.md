# Stage 6 — the Tier-5 product session (session document, drafted 2026-09-13)

Program unit P2 of [_INDEX-DUCT.md](_INDEX-DUCT.md); the in-repo successor to
"The Seventeen Gaps" (the 2026-08-31 private artifact noted in
[_NEXT.md](_NEXT.md) Stage 6). Source of every row: JOURNEY-MAP.md Tier 5
(X1–X17), the STATUS block's drift-patrol note, and the ledgers.

> **Decisions 2026-09-13 (Will: "Build it all", after the ratchet pass):** X1 BUILD · X2 BUILD · X3 BUILD in edit mode · X4 option D · X6 option D · J5-D option (b) + Pin · J5-A with X3 · J6-H in B19. Execution ledger: _INDEX-DUCT.md Wave 3 (D18–D25). The remaining `[decision]` slots below are the rows that were NOT on the What's Left canvas (fold-ins, defused, no-deliberately) and stand as written.

## Purpose, and how to use this document

One conversation, one table. Every `[decision]` slot below is Will's — the
recommendation column is the program's best read of the evidence, and nothing
in it is pre-decided (the buckets are the ones the 2026-08-31 note recorded,
re-checked today against the code that has shipped since). The outputs become
the next plan-of-record ladder exactly the way DUCT-PLAN.md did: the chosen
builds get Phase-4-style plans in `journeys/plans/`, an index ledger, and the
sequential agent loop; the "no, deliberately" rows get their reason written
here once so no future walk re-litigates them. Fill the slots in place and
commit — this file is the record.

## What changed since the Seventeen Gaps doc was prepared

- **Duct-by-size shipped and is live** — D1–D17 merged 2026-09-06 → 09-13, 17
  units, `duct_run` migration applied 2026-09-12, live walk passed on
  counttooling.com (583 lb bid weight hand-checked), and the drift patrol
  (P1) walked + verified J19 and re-walked J5 / J6 / J11 the same day. The
  demo moment now reads: click the RTU, move down the corridor, *"2,250 CFM
  downstream · suggests 20"Ø or 22×16 — S accepts"*, S, Enter, Schedule —
  **Bid weight 578 lb** — Export PDFs — *"Bid Check: Every room served? —
  Review · Export anyway"*: thirty seconds from a bare architectural plan to a
  priced, checked duct layout ([journeys/duct-takeoff.md](../duct-takeoff.md)
  "Demo moment"). The 2026-08-31 note framed duct-by-size as the session's one
  sequencing decision. **That decision is retired** — §8 asks the next one.
- **The Electrical layer landed in parallel** — "Electrical, First-Class"
  S1–S6 merged 2026-09-08 (PRs #71–#75, per CHANGELOG.md): the Trade switch
  (`state.trade`, S1), mount heights + vertical-by-default on the Chain tool
  (S1/S2), conductors on the run (S3), circuits as a group tag + homerun +
  circuit schedule (S4), **Bid Check** (S5 — the panel D9 later dropped the
  duct rows into), and the text-layer tag reader (S6 — the primitive D10's
  plan-and-spec callouts reuse). The rulebook (slices 1–4, 2026-09-09) put the
  § chip on Bid Check rows and the Duct Schedule headers, and gave plumbing its
  first auto row (hangers on every supported run, slice 3).
- **The smart-run pattern is now proven twice.** The seams that carried both
  skins, by name: the Trade switch; a group with one optional tag (panel ·
  circuit / equipment · capacity); a run that carries trade data (conductors /
  size segments); the S-moment suggestion under the cursor (tag chip / size
  chip); the Bid Check table with AUTO rows that show their work and MANUAL
  ticks; the export-gate advisory on the T1-05 gate moment; the PDF text layer
  read near a point. DUCT-PLAN.md wrote it as *"Trade-skinnable like the rest
  of the smart-run pattern"* — that line is now a fact, not a plan.
- **What that does to the 17 rows:** none is defused by duct or electrical
  directly — the gaps live on the older surfaces (zones, layers, scale, rooms,
  copy scopes, toasts). Four are **reframed**: X8 (the toast roulette grew two
  more systems on the same corner — S5's advisory card and D9's interactive
  gate toast; J19's duplicate-surface notes name them); X3 (the S hotkey is the
  re-edit route, and the J5-A stumble shows S dropping a live draft — the two
  belong in one fix); X4 (D7 put room type, target and the served/needs ⚠ on
  the Rooms rows and the legend — the on-plan label question now carries that
  weight too); X11 (the duct build added `ductRuns` to `pageHasAnyAnnotations` — the
  function has been touched since, the scale branch still isn't there). The
  three DEFUSED rows were defused by the August tiers and are confirmed in
  today's code (§3 cites the lines).

## The seventeen rows, bucketed

Buckets: **BUILD** · **PRODUCT CALL** · **FOLD-IN** (rides an existing pass or
batch) · **DEFUSED** (shipped code closes it — cited) · **NO, DELIBERATELY**.
The recommendation column re-checks the 2026-08-31 buckets against main as of
this morning (D17 merged); nothing moved bucket.

| # | Gap (journeys) | Bucket | Reasoning — the honest tradeoff | `[decision]` |
|---|---|---|---|---|
| X1 | Zones can't be moved or resized; an empty-rect Apply used to mint an invisible no-op zone that blocked later placements (J6) | **BUILD** | The guard half shipped (T2-10 refuses ~zero-size rectangles); the handles half is the strongest remaining candidate — today a mis-placed zone is delete + re-arm + two clicks + the dialog again. Cost: hitTest + drag on a rectangle that has to coexist with the aim loupe (M) | ☑ shipped 2026-09-13 (D23) |
| X2 | Mobile has no layers peek — no live way to see two layers together (J8) | **BUILD** | The desktop peek (`#showAllCanvasesBtn` + its right-click checklist) exists; mobile's footer layers menu (`#canvasLayersBtn` → `#canvasMenu`) just lacks the row. One row, no new mode (S). Cost: the peek auto-clears on pages with <2 layers, so the row must appear only where it works | ☑ shipped 2026-09-13 (D22) |
| X3 | Once a scale is set the header Set Scale button hides (`.header #setScale.scale-set { display:none }`, styles.css:132); re-editing requires knowing the sidebar readout is clickable, or S (J7) | **BUILD** | Trust-critical surface, findability fail by construction; S is the keyboard route and J5-A shows it dropping drafts. Keep the button in a "set" state showing the value — it already renders that content (`setScaleContent`, app.js:2332). Cost: two twins (header + sidebar) showing the same value until one is retired (S) | `[ ]` |
| X4 | Every box of a multi-box room draws the full Name + L×W×H label — labels overlap and cover the plan's room names (J7) | **PRODUCT CALL** | Per-box labels are the on-plan receipt reviewers check on the export; once-per-room labels read cleaner but hide each box's own dimensions. D7's air ⚠ raised the stakes of whatever the label carries. Needs a mockup round, not a code decision (§5) | ☑ option D shipped 2026-09-13 (D24) |
| X5 | On-plan legend lands half off-canvas after fit-zoom at 1380 px (J7) | **DEFUSED** | B10 (merged 2026-08-30) walks the anchor left/up until the box fits inside the 10 pt margin before sizing — canvas-draw.js `// B10 (J18)` block. No initial placement can land off-sheet now | — |
| X6 | "All Visible Canvases" copies the ACTIVE layer per page — marks visibly on screen (the peek) are excluded: 6 copied while 11 showed (J11) | **PRODUCT CALL** | Rename-only was rejected by the J11 verifier as relabeling the lie. B4's dialect pass has since relabeled the copy menus *"Every sheet (visible layers)"* while Show Report / Download say *"(active layer)"* — **the copy semantics were not re-verified in this unit**; the J11 re-walk of 2026-09-13 recorded the labels, not the mode. Re-drive J11 Friction #2's recipe (five minutes) before the session; the either/or is in §5 | ☑ option D shipped 2026-09-13 (D25); the re-drive is copy-layers.spec.js's J11 case |
| X7 | "Copy Summary (Email/Text)" renders below the external-links row, detached from its export siblings (J11) | **FOLD-IN** | Still true today (app/index.html: `#copySummaryTextDropdown` sits after `.sidebar-tooling-links`). A markup move; rides the next output.js/sidebar batch — no plan needed | ☑ shipped 2026-09-14 (B20): `#copySummaryTextDropdown` moved above `.sidebar-tooling-links` (b20-patrol.spec.js pins the order) |
| X8 | One feedback system — native `alert()` / `confirm()` / styled toast / auto-modal roulette across save, load, share, clipboard (J16 J11 J14) | **FOLD-IN** | T2-04 made the standard (non-blocking `.toast-card` corner cards); ~25 native `alert(`/`confirm(` calls remain (report.js, export-pdfs.js, my-settings.js, manage-projects.js, save-project.js, rfi-flags.js, app.js) plus the admin access log (Stage 5 finding 2). Reframed: S5's advisory card and D9's gate toast are two more systems on the same corner (J19 dup-surface note). A sweep batch (B20), not a feature | ☑ shipped 2026-09-14 (B20): zero native calls remain — `App.confirmDialog` (confirm / input / info modes on `#confirmModal`) replaced every `confirm()` / `prompt()`, `showToast` every `alert()`; 15 specs re-pinned to the modal, b20-patrol.spec.js fails on any native dialog |
| X9 | Vertex edit splices the polyline out of annotations — totals visibly drop by its footage until Enter recommits (J5) | **NO, DELIBERATELY** | The splice IS the edit model (app.js:3027 lifts the polyline into `editingPolyline`); hiding the drop means faking a total during an edit, which is the thing T1-05 forbids. Reason recorded in §6 | `[ ]` |
| X10 | One Esc anywhere in scale pick/verify is a silent total exit — modal, points, message all gone (J3) | **NO, DELIBERATELY** | scale.js documents verify as *"ESCAPABLE by design — Esc at any stage"* and the toast says "Esc keeps this scale"; the modal-close Esc is the platform convention every modal shares (B1's ladder). Staging it would make scale the one modal Esc doesn't close | `[ ]` |
| X11 | Scale-only pages get the yellow badge but Shift+←/→ marked-nav skips them — `pageHasAnyAnnotations` has no scale branch (annotation-model.js:194, J3) | **FOLD-IN** | Still one branch; the duct build touched the function (`ductRuns`) without adding it. Rides B19 or the next annotation-model change; the JOURNEY-MAP note's "if it bites again" stands — no telemetry says it has | ☑ shipped 2026-09-13 with D19 (x-foldins.spec.js) |
| X12 | Tally grammar "1 lines"; the Create tab accepts an empty name and mints a type named "Line" (quick-line.js:115, app.js:3883, J5) | **FOLD-IN** | Copy pass. T2-05 fixed the counter twin (a blank counter name now falls back to the icon's name, never "Counter"); the line-type twin never got the same treatment. Pair with X13 in one batch | ☑ shipped 2026-09-13 with D19 (x-foldins.spec.js) |
| X13 | Number-strip odd states: tooltip "… of lines" (status-bar.js:335/337); ↻ enabled with no PDF and silently no-ops (J18) | **FOLD-IN** | Same copy pass as X12; the ↻ gate is one `disabled` toggle beside the has-pdf pattern T2-01 used | ☑ shipped 2026-09-13 with D19 (x-foldins.spec.js) |
| X14 | Esc closes the Export PDFs modal but not the Show Report / printer drop-ups (J10) | **NO, DELIBERATELY** | Drop-ups are click-away menus (app.js:6863 outside-click), the same convention as the ⋯ menu and the context menus; adding them to the Esc ladder puts a menu rung ahead of drawing-tool rungs for a low-stakes surface. Reason in §6 | `[ ]` |
| X15 | The only in-app account surface is the 38×17 px footer "Sign In" link; header account buttons permanently dead (J17) | **NO, DELIBERATELY** | The landing page is the front door (B7 put the "Accounts are set up by your office admin" line and the phone number on the wall; PR #64 gave locked-out users the self-serve email link); removing the dead header buttons was rejected as unsafe in Phase 2b. Not a takeoff journey — stays out | `[ ]` |
| X16 | Copy to /Tooling sits directly above the eye-catching PipeTooling / TakeoffTooling external links — first-timers leave the site (J13) | **DEFUSED** | B4 (merged 2026-08-30): Export PDFs is the yellow `sidebar-btn-primary`, Copy to /Tooling dropped to neighbor weight (app/index.html `#specificPages` / `#forPipeTooling`). The links are still adjacent — the misclick cost is reduced, not zero; X7's regroup would finish it | — |
| X17 | Success feedback splits by state (signed-out toast vs a 1.5 s click-swallowing "Copied" modal) — a re-copy within ~1.5 s silently does nothing (J11) | **DEFUSED** | T2-04 (merged 2026-08-30): `#pipeToolingCopiedModal` is now a non-blocking `.toast-card` in `#toastRegion` (index.html:1505 comment, styles.css:583) — nothing swallows the second click. The wording split (toast vs card) is X8's sweep | — |

Counts as written: **BUILD 3 · PRODUCT CALL 2 · FOLD-IN 5 · DEFUSED 3 · NO,
DELIBERATELY 4** — the 2026-08-31 numbers, unchanged.

## The three build candidates

**X1 — zone handles.** In Move, a scale zone or multiply zone gets the same
grab affordances the legend and notes already have: drag the body to move,
drag a corner to resize, cursor swap as the only chrome; the zone label and
the multiply factor re-tally live (the totals-only multiplication is a
protected strength — nothing is cloned). Spirit: (1) a mis-placed zone goes
from right-click → Delete → re-arm → two clicks → dialog to one drag; (2)
"zone" stays; (3) removes the delete-and-redraw loop, adds no button — the
budget is the hitTest rung; (4) findable the way note handles are — the cursor
changes at the edge. Size **M**: hitTest rung + drag with `pushUndoSnapshot`,
the aim-loupe coexistence rule T2-10 already solved for rectangle drawing,
one spec. Rides on T2-10's shared drag gesture, the legend's `userResized`
path, and B8's "zone tools stay armed" hint. Telemetry: fold a `zone_edit`
route into the existing `scale_set` (zone flavor) event.

**X2 — mobile peek.** A "Show all layers" row in the mobile footer layers menu
(`#canvasLayersBtn` → `#canvasMenu`, canvas-layers.js) that toggles the
existing `state.showAllCanvases`; the row shows only when the page has two or
more layers (the flag auto-clears below that, canvas-switcher.js — J11's
2026-08-09 nuance). No new mode, no new state. Spirit: (1) a phone user gets
the desktop's one-tap comparison instead of no route; (2) "layers" — the
guide is already titled Canvas layers, and the menu's "Canvases" title is a
B4-dialect leftover to fix in passing; (3) one row, zero new surface — it
reuses the desktop peek verbatim; (4) it sits in the menu the phone user
already opens to switch layers. Size **S**. Rides on canvas-layers.js's peek
and B9's touch batch (drawer auto-close). Telemetry: none needed (no layer
events exist; add `layer_peek` opportunistically if the file is open).

**X3 — scale re-edit.** (Ratchet 2026-09-13: the button stays AND opens in EDIT mode — the tab that set it, current value preloaded, two-point offering re-verify — so it is a change, not a do-over.) Stop hiding the header Set Scale button once a scale
is set: it stays, in a "set" state that reads the value (the sidebar twin
already renders value · label · px — `setScaleContent` fills both), so the
button you used to set the scale is the button you use to change it. Pair it
with the J5-A fix (§7) so S — the keyboard twin — no longer drops a live
draft. Spirit: (1) one place for scale, always, no "is that readout clickable"
decision; (2) "scale" is the trade word; (3) deletes the hide rule and the
lore; opens the question of retiring the sidebar twin as a separate surface
(Phase-1 named header/sidebar twins as the simplification target); (4) it
never disappears. Size **S** (CSS + the content already exists; the twin
retirement is a follow-on). Rides on T2-06's gate-link machinery and B8's
scale-modal fixes. Telemetry: `scale_set` already carries the outcome.

## The two product calls

**X6 — what does "every sheet" copy?** Either/or, with the honest cost each
way:

- **A. Semantics change — the copy matches the screen.** `'visible'` mode
  honors the show-all peek (active layer + the peek set on every page). Pro:
  the J11 moment ("I see 11, it copied 6") cannot happen. Con: a bid number
  now depends on a transient view toggle that auto-clears on single-layer
  pages — a copy that changes with a peek is its own trust problem.
- **B. Honest wording — say "(active layer)".** Match the copy menus to what
  Show Report / Download already say. Pro: cheap, true, one string. Con: the
  screen can still show marks the copy omits; the user is told, not helped.
- **D. Explicit layers, defaulting to what you see (A + C merged; recommended after the 2026-09-13 ratchet).** Two scopes (this sheet / everything) plus a layer picker only when a page has >1 layer, pre-checked to what is visible at copy time; the paste header names the layers included ("layers: Main, Gas"). Pro: matches the screen (the J11 moment cannot happen) AND is explicit, so the number is reproducible and never silently depends on a view toggle. Con: C's cost on the flagship surface, softened because the default needs no interaction.
- **C. Remove the decision.** Two scopes (this sheet / everything) plus a
  layer picker only when a page has >1 layer — the D14 "Every layer with
  marks" precedent from Export PDFs. Pro: spirit (1) — fewer decisions on the
  flagship handoff. Con: the biggest change of the three, on the surface with
  the most muscle memory (7 daily users, G1's caution).

Prerequisite: re-drive J11 Friction #2 on main (the labels moved under B4; the
mode may or may not have). `[decision]` ____

**X4 — how a multi-box room is labeled on the plan.** Either/or:

- **A. Label once per room.** The largest (or first) box carries Name +
  totals; the other boxes carry the name only (or "2 of 3"); optional leader.
  Pro: the plan's own room names stay readable; Con: a reviewer loses each
  box's L×W×H on the export — the receipt moves to the sidebar / report.
- **B. Keep per-box labels, shrink them.** Name-only on every box when a room
  has >1 box; dimensions in the sidebar Rooms rows and the legend (where D7
  already put type, target and the ⚠). Pro: no information leaves the plan
  entirely; Con: the overlap is reduced, not gone, on dense sheets.
- **C. Leave as-is.** The per-box label IS the on-plan proof; J7 called the
  Room Size loop the best-designed stretch of the app. Con: the J7 finding
  stands — labels cover the plan's room names on multi-box rooms.

- **D. Don't cover what the plan already says (recommended, 2026-09-13
  ratchet — "is that the best we can do?").** When a Room box is drawn, the
  D10 text-layer primitive looks inside it for printed room text; if found,
  the room NAME is pre-filled from the plan ("from the plan", exactly like
  the duct starting size) and the on-plan label stops repainting the name —
  it paints only the totals as a small tag placed where the printed text
  isn't (collision check against the text items, corner-first). Multi-box
  rooms label their union once. Pro: nothing shrinks, nothing leaves the
  plan, the plan's own lettering stays readable, and typing the name goes
  away; spirit (1)(2)(3)(4) all hold. Con: scanned plans (no text layer)
  fall back to B silently, so the two behaviors coexist; rides on D10.
  Size S–M (one primitive call + a placement rule).

Either A or B wants a mockup round first (the DUCT-PLAN way — artboards, an
estimator walkthrough); this is a design call before it is a build.
`[decision]` ____

## The "no, deliberately" four — reasons, written once

- **X9 — the vertex-edit total drop.** Editing lifts the polyline out of the
  annotations (`editingPolyline`) so the draft can be redrawn without a ghost
  twin; the footage leaves the totals for the duration of the edit and comes
  back on Enter. Faking the number during the edit would show a total the
  annotations don't contain — the exact thing T1-05 forbids. The honest
  improvement, if it ever bites, is a footer word ("editing — 35.7 ft
  pending"), which is a papercut, not a gap. Stays out.
- **X10 — Esc in scale pick/verify.** Esc-closes-the-modal is the one
  convention every modal shares (B1's ladder); verify is documented
  "escapable by design" and its toast says "Esc keeps this scale" — the
  applied scale survives, only the check is abandoned. Staging Esc here would
  make Set Scale the one modal Esc doesn't close. Stays out.
- **X14 — Esc on the report / printer drop-ups.** They are click-away menus,
  the same convention as the ⋯ menu and every context menu; a menu rung in
  the Esc ladder would sit ahead of drawing-tool rungs (the ladder order is
  load-bearing — B1 and D17 both had to slot rungs into it by hand). Low
  stakes, click-away works. Stays out.
- **X15 — the account surface.** Accounts are provisioned by an office admin
  (B7 says so on the wall; PR #64 added the self-serve sign-in email); the
  landing page is the front door and the footer link is the in-app one. Not a
  takeoff journey, and un-deadening the header account buttons was rejected
  as unsafe in Phase 2b. Stays out until the sales funnel says otherwise.

## Re-rank inputs from the drift patrol

Of the nine stumbles the patrol filed, six are already spent: J19 #1–#3 and
J5-B / J6-G shipped in D17; J19 #4–#6 were folded into B19 by Will on
2026-09-13. Three remain "awaiting re-rank":

| Stumble | What it is | Recommendation | `[decision]` |
|---|---|---|---|
| **J5-A** — Set Scale mid-draw drops the tool but not the draft | `setScaleClick` (features/scale.js) sets Move before opening the modal and clears neither `quickLineStart` nor `drawingPolyline`; after Esc/Cancel the polyline draft and its finish bar are alive "in Move" (J5 drift-patrol finding A; pre-existing since the 2026-05-30 split, not duct-caused — the duct trace guards S, the line tools don't) | **polish, S** — skip the tool reset when a draft is live (the modal never needs Move), or guard S the way the duct trace does; ship with X3 since S is the keyboard twin of the button | `[ ]` |
| **J5-D** (ratchet 2026-09-13: option (b) + a per-tool "Pin to strip" in the ⋯ menu, so the strip never shifts on its own) — Duct inline in the strip while Polyline sits behind ⋯ (⚑ contra D14's "keep the strip order") | The ⋯ overflow is unconditional on desktop; Duct got `strip: true` in D14, so a plumber sees the one HVAC drawing tool at hand and the bending-run tool a menu away (finding D, papercut) | **⚑ product call** — two honest options: (a) Duct joins the ⋯ group like Polyline (reverses D14, one flag); (b) the strip goes trade-aware — Duct inline for HVAC projects, Polyline inline for plumbing/electrical (`state.trade` exists since S1, the switch is per project). (b) honors both D14 and J5-D and costs one condition; recommended | `[ ]` |
| **J6-H** — Delete Area over a duct run says "No items in this area." and leaves it | `deleteZonePreview` and the delete walk enumerate counters, lines, notes, zones, rooms — not `ductRuns` / fittings (J6 finding H, papercut; already a B19 line) | **stays in B19** — the only re-rank question is severity: a bulk-erase tool that denies what is plainly there is stumble-shaped by the J9 precedent; either way it ships in the batch | `[ ]` |

## Sequencing slot — with duct done, what is the next big build?

The honest candidates, each with what it costs and what it proves:

1. **Electrical smart-run completion.** S1–S6 are merged and the tutorial
   rides them; "completion" means the program work the duct got and
   electrical didn't — a J20 `electrical-takeoff` dossier walked + verified as
   persona E (the J11 re-walk logged a plumbing Bid Check advisory "for the
   S-track, not filed here"), plus whatever the S-track's deliberately-out
   list (panel-schedule gesture, waste factor, assembly templates) is worth
   revisiting. Cost: a P1-shaped program unit, small code. Proves: the second
   skin holds under the same scrutiny as the first.
2. **The three X builds as one short ladder** (X3 + J5-A → X2 → X1: S, S, M).
   Cost: three one-topic branches, no new model. Proves: Tier 5 closes; the
   program's own gap list is spent, not parked.
3. **Plumbing fixture-unit sizing — the third skin.** The P persona is the
   daily core (J5/J4 carry the telemetry weight) and has the least of the
   smart-run pattern: the hanger Bid Check row (rules slice 3) is its only
   auto row. Fixture units → pipe size at the S moment (DFU/WSFU tables from
   the rulebook, the ductulator's exact shape: "6 WSFU downstream · suggests
   3/4" — S accepts") is the plumbing analogue of duct-by-size, riding the
   same seams DUCT-PLAN named — *"Trade-skinnable like the rest of the
   smart-run pattern"* — with the size chip, the S popover, the schedule and
   the gate already built. Cost: a DUCT-PLAN-sized plan (mockup rounds, a
   plumber walkthrough, a rulebook slice for the fixture-unit tables), then a
   D-ladder. Proves: the pattern is a product, not two features.

Recommendation, for the slot only: **2 then 3**, with 1 run as a program unit
in the gap between them (it is mostly agents, not code). The X ladder is a
week of small branches that retires this document's reason to exist; the
plumbing skin is the build that moves the core user, and the mockup rounds
can start while the X ladder ships. `[decision]` **3 — plumbing fixture-unit sizing (Will, 2026-09-14): IPC first, water only, mockups before code.** Plan of record: [WATER-PLAN.md](WATER-PLAN.md); the X ladder had already shipped as D20–D25; candidate 1 (the J20 electrical dossier walk) runs as a program unit in the gaps.

## After the session

1. **Write the plan-of-record for the chosen ladder**, Phase-4 style: one
   self-contained plan per chosen build in `journeys/plans/` (the T-plans are
   the template — problem verified with line numbers re-grepped, design,
   simplicity budget, what does NOT change, specs, docs rows, `build:sw`), an
   index ledger like `_INDEX-DUCT.md`, the sequential loop, `npm run check`
   before every merge. A plumbing-skin choice starts with mockups, not plans.
2. **Stamp the decisions back**: JOURNEY-MAP Tier 5 gets a status column
   (build / call / fold-in / defused / no) from the table above, the two
   product calls and J5-D get their ⚑ resolved in the STATUS block, and
   `_NEXT.md` Stage 6 flips to COMPLETE with the date.
3. **Tier-3 B19** runs on the Stage-4 loop regardless of the session's
   outcome — it carries J19 #7–#14, the re-walk papercuts (J5-C/D/E, J6-H,
   J11-I) and J19 #4–#6; the FOLD-IN rows above (X7, X8's sweep as B20,
   X11–X13) queue behind it.
4. **Day-7 `duct_run` telemetry line, ~2026-09-19** (migration applied
   2026-09-12): read-only pull, appended to `_INDEX-DUCT.md` and the J19
   dossier's Evidence — commits / segments / pounds per run, `client_error`
   flat, and whether the copies now fire `copy_summary` with duct present.
   Anything hot is a fix-forward PR, not a plan.
5. **Drift patrol stays standing practice**: whichever build ships next gets
   its single-journey walk + verify and a dossier update, the same way J19
   did for duct.

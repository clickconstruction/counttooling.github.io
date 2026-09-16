# H1 — The five-minute HVAC takeoff (the third walkthrough)

> Sheet replaced 2026-09-14, see [SAMPLE-PLANS.md](SAMPLE-PLANS.md): the rooms, fixtures and figures below describe the old sample plan (D26, 2026-09-16).

> Plan of record, written 2026-09-14 after the D25 push and live walk. Will's
> ask: "add a walkthrough at the start for new users like we have for Plumbing
> and Electrical." Rows marked ⚑ are product calls; everything else is decided
> here with the reason stated. One unit, one branch (`claude/hvac-tour-h1`),
> the D1–D25 loop (targeted spec + `npm run check` per commit, full suite
> before merge, push after).

## Problem (verified)

- The empty-canvas hint offers two tours — `#canvasEmptyHintTour` (electrical)
  and `#canvasEmptyHintTourPlumbing` — from `features/tutorial.js` `TOURS`
  (`electrical` / `plumbing`, own `doneKey`, own `linkId`; `?tour=electrical`
  / `?tour=plumbing`; Project Settings links). There is no HVAC entry, so the
  trade with the most machinery to learn (D1–D25: CFM devices, the S popover
  and its suggestions, attachment, systems, the schedule, the gate) is the one
  a new user meets cold. The HVAC guides describe it; nothing walks it.
- The engine is trade-agnostic by construction: a step is
  `{ id, title, body, kind: 'do'|'read', target: [selectors, deepest first],
  check(), action?: { label, run }, hint?() }`; `check()` reads REAL app state
  and the step advances when it is true; `action.run` performs the same change
  through `App.*` entry points a click would ("Do it for me"); Back holds. Both
  tours share `SCALE_STEP` and `PROVE_STEP` on `samples/sample-plan.pdf`
  (1224×792, true ANSI B at a true 1/8", Men 105 / Women 106 restrooms; the
  20'-0" dimension under Women 106 is the proof). The sample plan PRINTS its
  room names ("OPEN OFFICE 104", "CONFERENCE 103") — exactly what D24 reads —
  and carries no duct callouts.
- Every step below exists as shipped behavior with a spec seam; the tour adds
  no product code, only the third `TOURS` entry, its steps, its link, its done
  key, and its spec.

> **Built 2026-09-14** as planned with one reorder found in the build: a run
> inherits its system from `state.activeGroupId` at trace time and there is no
> UI to assign a run afterwards, so **step 7 is the system and step 8 the main**
> (RTU-1 becomes the active group; the main inherits it). Still 14 steps.
> Also found in the build: the sample plan's drawing sits at **0.75× its SVG
> units** (the SVG is 1224 CSS px on a 1224-pt sheet — the factor the plumbing
> tour's `DIM_20FT` already carries), so OPEN OFFICE 104 is 207×173 pt =
> **442 ft²**, not 812, and four 150-CFM diffusers **serve** it (600 ≥ 442):
> ⚑2 resolves to "served by design" — the gate still has the unticked manual
> rows to ask about. D24 reads "OPEN OFFICE" (the number is its own print).

## Design

### The route (14 steps, the plumbing tour's length)

| # | id | kind | What the reader does | `check()` on real state | Do-it-for-me |
|---|---|---|---|---|---|
| 1 | `welcome` | do | Load the sample plan; the project is stamped **HVAC** (`setProjectTrade('hvac')`, NOT remembered as the device default — the plumbing tour's rule) | `state.pages.length && state.trade === 'hvac'` | fetch + stamp |
| 2 | `scale` | do | shared `SCALE_STEP` (1/8" = 1') | shared | shared |
| 3 | `measure` | do | shared `PROVE_STEP` (20'-0") | shared | shared |
| 4 | `room` | do | **Box OPEN OFFICE 104** with Room Sizer (V). The dialog already knows the room's name — *from the plan* (D24) — pick **Office** as the room type and 9' ceiling; Apply. The sheet gets one totals tag; the Rooms row shows a needs-CFM target. Deck height 12' rides the same dialog (D17). | a room with `nameFromPlan && roomType` and ≥1 box; `ductSettings.deckHeightFt > 0` | draw the box at the room's outline, set type/height/deck through the dialog's own entry points |
| 5 | `counter` | do | **A diffuser with a CFM.** Create tab: the air & mounting fields are already unfolded on an HVAC project (D19); type 150 CFM — the chip beside it says *→ Supply Diffuser* (D18). Create. | a counter with `cfm > 0` | create it |
| 6 | `place` | do | **Place four diffusers** in the open office | `markCount(cid) >= 4` | four markers on a grid inside the room |
| 7 | `duct` | do | **Trace the main** with Duct (U): start 24×12 from the corridor side, click along the office; the chip under the cursor reads *"600 CFM downstream · suggests …"*; press S, tap the suggestion (the round-first pair), Enter to commit. Fittings count themselves. | a duct run with ≥2 segments (a size step taken) | trace 3 vertices, apply the suggestion at vertex 2 through `applyDuctSizeStep`, commit |
| 8 | `attach` | do | **Hang the strays.** Two of the four diffusers sit within 8" of the run and draw dashed leaders; two don't. Right-click a bare one → **Attach to nearest run** (D19). | every CFM device attached (`attachDuctDevices(...).unattached.length === 0`) | rescue both through `App.strayDeviceAttachTarget` + the same move |
| 9 | `system` | do | **Name the system.** Groups turned themselves on at the first run (D17); make **RTU-1** with a 2,000 CFM capacity and assign the run. The header reads designed vs capacity. | a group with `capacityCfm > 0` and the run's `systemGroupId` set | create through `App.openGroupModal`'s save path |
| 10 | `schedule` | read | **Pounds, not feet.** Open the Duct Schedule: per-size LF · lb rows, the fittings counted, seam & waste, **Bid weight**. | Next (the button is spotlit; opening it is optional) | — |
| 11 | `bidcheck` | do | **Sign off.** Tick *Fits the roof* by its label (D18); the auto rows already judged the rooms, flex and scale. | `state.bidCheck.manual['duct-fits-roof'] === true` | tick it |
| 12 | `handoff` | read | **Copy to /Tooling → Everything**: the header names the scope and layers (D25); the *--- Duct ---* block carries the pounds (D17). The gate asks about the under-served room — *Export anyway* remembers the answer (D18). | Next | — |
| 13 | `legend` | read | What the sheet now says: the true-width ghost, the size chips, the totals tag, the legend's duct rows and the ⚠ air line. Toggle **Show duct true width** off and on in Legend Settings (the rows only appeared once a run existed — D19). | Next | — |
| 14 | `done` | read | "That is the whole loop" — links to the two guides. | — | — |

Step count matches plumbing (14) so `#tourStepNo` pins hold their shape.

### Where the numbers come from (so the tour cannot lie)

- OPEN OFFICE 104 on the sample plan is 280×235 PDF pt at 9 px/ft (1/8") =
  31.1' × 26.1' ≈ 812 ft²; Office at 1 CFM/ft² → **target ≈ 812 CFM**. Four
  150-CFM diffusers serve 600 → the room reads ⚠ under-served by design: that
  is the Bid Check / gate moment in steps 11–12, and step 13's ⚠ legend line.
  ⚑ If Will would rather the tour end "green", place **six** diffusers (900)
  in step 6 — the rest of the plan is unchanged.
- The main starts 24×12 so the suggestion at vertex 2 is a visible step DOWN
  (600 CFM at 0.08″/100′ suggests ~14"Ø / 16×10); the tour's `body` quotes
  whatever `App.getDuctDraftSuggestion()` returns at that moment rather than a
  literal, so a knob change cannot make the copy wrong.

### Markup — `app/index.html`
- `#canvasEmptyHint`: a third link `#canvasEmptyHintTourHvac` ("hvac") beside
  plumbing · electrical; the whole offer hides only when all THREE done keys
  are set (today: both).
- Project Settings: an "HVAC tour" link beside the two existing ones.

### Logic — `features/tutorial.js`
- `HVAC_STEPS` (above) + `TOURS.hvac = { steps, doneKey:
  'clickcount-tour-done-hvac', linkId: 'canvasEmptyHintTourHvac' }`;
  `?tour=hvac`. Reuse `SCALE_STEP` / `PROVE_STEP` and the plumbing tour's
  `welcome` shape (fetch the sample plan into `#pdfInput`, stamp the trade
  WITHOUT `remember`).
- New do-it-for-me runners, each through the shipped entry point — never a
  hand-built state mutation where an `App.*` writer exists: `App.openRoomBoxModal`
  + the dialog's Apply, `App.setDuctDeckHeight`, the counter Create path,
  `App.strayDeviceAttachTarget` + the marker move, `App.openDuctScheduleModal`.
- Targets are ladders, deepest first, so the spotlight follows the reader into
  the Room Size dialog (`#roomBoxType`), the Create tab (`#counterCfm`, which
  sits inside the disclosure — target the field, and if the disclosure is
  closed the runner opens it through `App.applyCounterAirMore`'s toggle), the
  S popover (`#ductSizePopover`), the context menu (`#ctxAttachToRun`), the
  Groups modal, the Bid Check row.

### What does NOT change
- No product code. No sample-plan change (⚑ see below). The two existing
  tours' steps, ids, done keys and `#tourStepNo` counts are untouched;
  `tutorial.spec.js`'s electrical and plumbing cases must pass unmodified.
- The empty-canvas hint's B16 drag-drop and its mixed-shell fallback
  (tutorial.spec "stylesheet a deploy behind") are unchanged.

### ⚑ Product calls
1. **Sample plan duct callouts.** Adding printed "24x12" / "20x12" beside a
   corridor line to `scripts/build-sample-plan.js` would let the tour show
   D10's *"from the plan"* prefill and *"Plan says 20×12 here — S accepts"*.
   Cost: `npm run build:sample-plan` regenerates the PDF both existing tours
   run on (their geometry — restroom fixtures, the 20' dimension — is
   untouched, but the guide screenshots would need `build:screenshots`
   re-run and re-checked). **Recommendation: not in H1.** The design-build
   suggestion is the more general lesson; callouts can be a 15th step later.
2. **Under-served by design (612 vs 812)** — see "Where the numbers come
   from". Recommendation: keep it; the gate is the point.
3. **Step 9 (systems)** is the longest step to explain. Recommendation: keep
   it — every system-scoped number (capacity, ESP, per-system flex) is dark
   without it, and D17 already made Groups self-enabling.

## Tests
- `tutorial.spec.js`: an `hvac` case mirroring the plumbing one — the third
  link and `?tour=hvac` start it; do-it-for-me builds a real HVAC takeoff
  (assert after the run: trade hvac, a plan-named typed room with a deck
  height, a CFM counter with 4 markers, a duct run with a size step and auto
  fittings, zero unattached devices, a capacity group, the ticked manual row);
  a real click satisfies step 8 (right-click → Attach); Back holds; finishing
  HVAC hides only its link; a cloud project refuses to start. Plus the
  three-links / three-done-keys visibility matrix.
- `guides.test.js` unchanged (no new article); `build:guides --check` after the
  hvac-takeoff.md edit.

## Telemetry
- The tours already log `tutorial_step` (id, tour); no new event. Read the
  `hvac` tour's drop-off at day 7 beside the other two.

## Docs & shipping checklist
- `content/guides/hvac-takeoff.md` + `duct-takeoff-by-the-pound.md`: "New
  here? The five-minute HVAC tour walks this on the sample plan" line at the
  top, like plumbing-takeoff.md's.
- ARCHITECTURE.md Files table, tutorial.js row: the third tour. AGENTS.md
  persisted-settings list: `clickcount-tour-done-hvac`; the "walkthrough was
  finished" sentence becomes three keys. FEATURES.md if it counts the tours.
- `npm run build:sw` (tutorial.js and app/index.html are precached); ledger
  row H1 in `_INDEX-DUCT.md` (Wave 4); JOURNEY-MAP J19 "Guide gaps" row.

## Risks & edge cases
- The disclosure (D19): on an HVAC project it opens by itself, but a device
  that stated plumbing earlier and hit "remember" would arrive with it
  closed — the runner and the target ladder handle both states.
- Mobile: the tours are desktop-first today (the plumbing tour's ⋯-menu
  wording); the HVAC tour says "U" and "S" and inherits the same coarse-pointer
  copy swaps B9 applied. Not a new regime.
- The S popover step: the reader may accept the suggestion by tapping the chip
  instead of pressing S — both paths end in a size step, and `check()` reads
  the run, not the route.

## Acceptance criteria (walkable)
A new device, empty canvas: three tour links. Click **hvac** → the sample
plan loads stamped HVAC → scale, proof → box OPEN OFFICE 104 and see its name
already in the dialog → a 150-CFM diffuser with the chip → four placed → a
main traced with the suggestion taken at S → two leaders, two strays rescued
from the menu → RTU-1 at 2,000 CFM → the schedule's bid weight → *Fits the
roof* ticked by its label → Copy to /Tooling shows the header and the duct
block, the gate asks about the office, Export anyway → the legend rows — and
"That is the whole loop". Finishing hides only the hvac link. Size: **M**
(one day with the spec).

# Water sizing by fixture units — plan of record (draft for the mockup round)

> Status 2026-09-14: the Stage-6 sequencing slot resolved (Will, 2026-09-14):
> **candidate 3 — plumbing fixture-unit sizing, IPC first, water only,
> mockups before code.** This is the plan the mockup round refines; nothing
> here is built. The artboards for the plumber walkthrough are the "Water
> Sizing" artifact (six boards, listed in §9; private, ask Stephen for the
> link — https://claude.ai/code/artifact/4aeb6e7b-7aab-41e2-ba3c-dca15af6404a). The electrical J20 dossier walk
> (candidate 1) runs as a program unit in the gaps. **2026-09-14:** the advanced sample
> plan (`samples/sample-plan-advanced.pdf`, a restaurant plumbing sheet) shipped as the
> walkthrough's sheet — the plumber pokes at the real thing in the app, not only the boards.
>
> **Mockup round decided 2026-09-14 (all six, recommendation taken on each):**
> **Q1 one size per run** — a size change is a new run from here; no size
> segments on lines (rung 4 stays on the existing line model). **Q2 the cap,
> not the pressure** — ship the velocity-capped size at S, stamped "practice,
> not code"; *Pressure available checked (Appendix E)* starts as a manual Bid
> Check tick and upgrades itself once the critical-path math exists. **Q3
> occupancy** — one project-level private/public toggle beside the code
> edition (public by default on a commercial bid), a per-counter flip to the
> other column, and the per-mark WSFU override. **Q4 hot and cold** — water
> side is a property of the line type (*3/4in PEX hot* / *3/4in PEX cold*);
> the sidebar may group by side to keep the list short. **Q5 the chip** —
> size first: *"3/4″ suggested · 6 WSFU downstream · 5 fps · S accepts"*;
> gpm moves to the S popover and the schedule. **Q6 scope** — water only in
> this slice; drainage (DFU → DWV, slope, vents) is the next slice. The
> ladder in §6 is unblocked; rung 1 (the rulebook slice) can cut a branch.
> The "Water Sizing" artboards were not reachable from the session that
> recorded this; the calls were made against §7's worked example and the
> advanced sample plan in the app.
>
> **Rung 1 shipped 2026-09-23** (branch `claude/water-rung-1`, punch row P4-WATER):
> [water-model.js](../../water-model.js) holds the tables (the WSFU loads, the demand
> curve, the velocity caps, the pipe bores, the fixture supply minimums, the 3/4 in
> service) and the arithmetic over them (`demandGpm`, `velocityFps`,
> `suggestWaterSizeIn`); the six rules of §2 are in `content/rules/plumbing/` as
> **drafts** with a `code:` pointer on every one of their 225 values, so the drift
> check pins them from here on; the project **occupancy** (public | private) is a
> one-word flip in Project Settings' Codes row hint, riding `state.codes` through
> every intake and the device default like the editions (codes.spec.js). Nothing
> reads the tables in the app yet; rung 2 is the counter's WSFU field. The
> transcriptions are punch row **WATER-TABLES** (a tester with the trade, against the
> printed IPC) before rung 4 is offered.
>
> **Rung 2 shipped 2026-09-23** (branch `claude/water-rung-2`, stacked on rung 1):
> [features/water-fixtures.js](../../features/water-fixtures.js). A counter's **Fixture
> units** field on the Create tab, the Quick Count twin and the details modal, prefilled
> from the name for the project's occupancy (water-model's `wsfuFixtureFromName` reads
> the trade's names: Lav, WC, UR, mop sink, 3-comp sink, EWC, DW…; a bare public WC is a
> flush valve, a private one a flush tank) with the chip and the § chip; the chip's
> occupancy word is Q3's per-counter flip (`wsfuOccupancy`); the per-mark override
> (*WSFU for this one…*, `wsfuOverride`); the Summary's **Fixture units** line (the
> "total WSFU per sheet" §6 promised, per sheet in the hover). `plumb.wsfu.fixtures` is
> **applied** now. Not in this rung: the `wsfu_prefill` telemetry of §8 waits for rung 4's
> `water_run` so the allowlist migration is applied once.
>
> **Rung 3 shipped 2026-09-23** (branch `claude/water-rung-3`, stacked on rung 2):
> [features/water-runs.js](../../features/water-runs.js). A line type's **Water** side (—,
> Cold, Hot) on the sidebar Add Line Type modal, the Choose Line Type modal's Create and
> Quick tabs and the details modal, prefilled from the name (hot / HW / cold / CW); every
> line of a sided type is a water run. Fixtures attach **per side** to the nearest run of
> that side within the duct tap snap (a lavatory ties to its cold run and its hot run
> separately; a WC to cold only; a typed-over number splits pro rata to the table row; a
> fixture the table does not know counts its whole number on each side it touches),
> derived from geometry every read, never stored. The dashed leaders paint in the run's
> color (canvas-draw.js); the shared *Attach to nearest run* row rescues a fixture with a
> side nothing serves; the line type row reads "cold · 12 WSFU served · 2 fixtures" and
> the Lines list "cold · 6 WSFU" per run. `App.getWaterServed(pageIdx)` is rung 4's input.
>
> **Rung 4 shipped 2026-09-23** (branch `claude/water-rung-4`, stacked on rung 3):
> [features/water-size.js](../../features/water-size.js). While a polyline of a water-sided
> type is traced, the card above the footer reads the load still to serve beyond the tip
> (water-model `waterDraftRemainingLoad`: fixtures of the side at or past the tip, on
> branches tapped off the draft, or on no run of the side; a flush valve picks the demand
> column) and the smallest size of the type's material under the side's cap, Q5's wording
> ("3/4″ suggested · 6 WSFU downstream · 5.1 fps · S accepts"). S or a tap opens the popover:
> the suggested chip, the material's ladder with every size's velocity, the new-run note.
> Taking a size is Q1: the run so far commits, a type of the new size is found or made (the
> name's size swapped, side carried, hangers re-read), and the next draft starts from the
> last point in it. Not in this rung: the Quick Line (single-segment) trace gets no card; the
> `water_run` telemetry waits for rung 5's knobs so the migration lands once.
>
> **Rung 5 shipped 2026-09-23** (branch `claude/water-rung-5`, stacked on rung 4):
> [features/water-schedule.js](../../features/water-schedule.js). The **Water Sizing**
> schedule (the Water button on the Line Types header, shown once a type has a side): one
> row per water run with its size, the fixture units at its head (branches included), the
> flow in the column its fixtures call for, the velocity at that size and the check (✓, ⚠
> over the cap → the passing size, ⚠ under a served fixture's Table 604.4 minimum, or unsized
> when the type's name carries no material or size), cold and hot totals, the fixtures no
> run reaches; the velocity caps per side (`state.waterSettings.capFps`, every intake) and
> the occupancy column at the foot; Copy Schedule; the report table; the
> `--- Water sizing ---` block in Copy Summary / Copy to /Tooling, read back by the paste
> summary as its own unit. `plumb.wsfu.demand`, `plumb.water.velocity`, `plumb.water.pipe-id`
> and `plumb.water.fixture-supply-min` are **applied** now. Telemetry (`water_run`,
> `wsfu_prefill`) is still not wired: one allowlist migration for the whole ladder, with rung 6.
>
> **Rung 6 shipped 2026-09-23** (branch `claude/water-rung-6`, stacked on rung 5; **the ladder
> is built**): [features/water-bidcheck.js](../../features/water-bidcheck.js) feeds Bid Check the
> five auto rows of §4 and the four manual rows once a project has a water run (the service
> row is new: a run named *service* under 3/4″, `plumb.water.distribution-min` applied); the
> export gate's scope includes water, so the badge and the Review · Export anyway toast serve
> it unchanged. The plumbing walkthrough gains its fourth step set, *Size the branch at S*
> (give the pipe its water, fixture units on the lavatory, trace the main and take 3/4″ at S),
> and the plumbing guide names the rows. Telemetry (§8): `water_run` and `wsfu_prefill` are
> wired behind the `water-telemetry` feature flag with migration
> `20260923190000_log_user_event_water.sql` in the repo, unapplied; punch row WATER-TELEM
> applies it and flips the flag. Open, not blocking: WATER-TABLES (the trade check of the
> rules) and the Quick Line trace (one segment) gets no card.

The thesis, in the words the Stage-6 doc used: fixture units → pipe size at
the S moment is the plumbing analogue of duct-by-size, riding the seams
DUCT-PLAN named — the size chip, the `S` popover, the schedule, the export
gate, the rulebook chips — so the smart-run pattern reads as a product, not
two features. The P persona is the daily core (J4/J5 carry the telemetry
weight) and today has one auto Bid Check row (hangers). This gives it the rest.

## 1. The model (water only, IPC first)

- **A fixture carries its water supply fixture units.** A counter gets an
  optional **WSFU** field under **More ▸ water supply** (the CFM field's
  twin, folded away on non-plumbing projects, open by itself on a plumbing
  one). The rulebook fills it from the counter's name the way the hanger
  rule reads a material off a line type: *Lavatory* → the IPC Table
  E103.3(2) value for the project's **occupancy** (private / public, one
  project-level toggle beside the code edition; public is the default on a
  commercial bid; a counter can be flipped to the other column — Q3). A chip beside the field names the rule and the value it
  read (*→ 2.0 WSFU · public lavatory · IPC E103.3(2)*); type over it and
  the counter keeps yours. A placed mark can carry its own override
  (right-click → *WSFU for this one…*), the CFM-override precedent.
- **A water run is a line whose type says hot or cold.** *Water side* is a
  property of the line type (the airside precedent: Supply/Return/Exhaust →
  **Hot / Cold**), set on the Quick Line tab and in the type's details;
  the Quick Line name still assembles as *3/4in PEX*, and the size in the
  name is the size the rules read (`supportSizeInFromName` already parses
  it). Runs with no water side are what they are today: pipe with a length.
- **Fixtures belong to the run that serves them.** The same attachment the
  duct model uses (snap distance on the sheet, dashed leader, *Attach to
  nearest run* rescue) puts a fixture on a run; a run started on a run is a
  branch of it (the tap precedent). Nothing new to draw.
- **Downstream fixture units are computed at the cursor.** While a water
  run is being traced, the chip riding the cursor reads the WSFU of every
  attached fixture *not yet served by a committed branch* beyond that point
  — the ductulator's "air still to serve," in fixture units — converts it
  to a design flow through the IPC demand curve (Table E103.3(3), flush-tank
  or flush-valve column by the fixtures present), and suggests the smallest
  nominal size whose velocity stays under the cap for that side:
  *"3/4″ suggested · 6 WSFU downstream · 5 fps · S accepts"* (Q5: size
  first; the design gpm shows in the popover and the schedule, not on the
  cursor). Press `S` and the suggestion sits at the top of the popover with
  its gpm; one tap takes it. Suggestions only ever *inform* — the size never changes unless you
  take it.
- **A size change is a new run from here.** Water mains step down as
  fixtures peel off, but a line has one size (its type). Taking a smaller
  size at `S` ends the current run at the last point and starts the next
  one there in the sized type (the Chain tool's "run back to the previous
  one" shape, forward); the two share the point, so drops and hangers
  count once. This keeps every existing export, spec and report untouched
  — no size segments on lines — confirmed by the walkthrough (§9, Q1,
  2026-09-14).
- **The Water Sizing schedule prices like a bid.** Per run: side, WSFU
  served, design gpm, size, velocity at that size, ✓ / ⚠ (over the cap, or
  under a fixture-supply minimum), with hot and cold totals; the two knobs
  (velocity cap per side, occupancy) live at its foot and stick with the
  project. It rides Show Report / Export PDFs as a table and Copy Summary /
  Copy to /Tooling as a `--- Water sizing ---` block, the `--- Duct ---`
  precedent.

## 2. The rulebook slice (IPC 2018 / 2021, Appendix E) — transcribed, not typed

Every number the app applies must be a rulebook rule with a `code:` pointer
into the data table that uses it (`npm run build:rules` checks them against
each other on every build). The slice, in the order the ladder needs it:

| Rule | Source | The app uses it for |
|---|---|---|
| `plumb.wsfu.fixtures` — load values per fixture, private and public columns, hot/cold/total | IPC Table E103.3(2) | the counter's WSFU prefill by name; the sidebar chip |
| `plumb.wsfu.demand` — WSFU → gpm, flush-tank and flush-valve columns | IPC Table E103.3(3) | the design flow behind every suggestion |
| `plumb.water.velocity` — maximum velocity per side (defaults: cold 8 fps, hot 5 fps) | not a code table: the trade's design practice (manufacturer / ASPE guidance; the IPC method sizes by pressure and length, §3 below) | the size pick; editable knob, stamped "practice, not code" |
| `plumb.water.pipe-id` — nominal size → inside diameter for the materials the Quick Line knows (PEX, copper L, CPVC, galvanized) | manufacturer / ASTM dimensions | velocity = gpm ÷ area |
| `plumb.water.fixture-supply-min` — minimum fixture supply pipe size per fixture | IPC Table 604.4 | the ⚠ on a branch smaller than its fixture's minimum; a Bid Check row |
| `plumb.water.distribution-min` — minimum building supply and distribution sizes | IPC 604.3 / 604.4 | a Bid Check row |

**The values in the mockups are illustrative.** The slice is written by
transcribing the code tables (2018 and 2021 editions, with the project's
edition chip already on every rule pop-over) and is checked by the plumber
walkthrough before the first branch merges. No number in this plan or on an
artboard is a claim about the code.

## 3. Deliberately a rule of thumb (keep the spirit)

The IPC Appendix E method sizes by **pressure available and developed
length** (Tables E103.3(4)–(7): the pressure range, the equivalent length of
the critical run, the friction loss per 100 ft). That is the master's full
calculation, and it is the analogue of the duct's *static path* row — it
belongs to Bid Check, not to the S moment. The S moment gives the size an
experienced estimator would pencil in on a walk-through (fixture units →
demand → a velocity-capped size), which is exactly what the ductulator
suggestion is for air. The gap between the two is stated on the schedule
foot (*"sized at 5/8 fps; the pressure check is Bid Check's"*) so nobody
mistakes a rule of thumb for a design.

Out with it, for the same reasons DUCT-PLAN kept them out: **drainage
(DFU → DWV sizing, slope, vent sizing)** — the second slice, after water
proves the shape; **hot-water recirculation**; **water-heater sizing**;
**labor/dollars** (sizes and counts are the handoff; pricing stays in
PipeTooling); **auto-tracing**.

## 4. The Bid Check (the pattern's sign-off)

Auto rows, arriving as their computations land:

1. **Every water run sized for its fixture units** — the schedule's ⚠
   count: runs whose velocity at the taken size exceeds the cap for their
   side. Names the run and the size that passes (*"Lav battery cold: 1/2″ at
   9.2 fps ⚠ → 3/4″ 4.1 fps ✓"*).
2. **Fixture supply minimums** — a fixture attached to a branch smaller
   than IPC Table 604.4 allows (*"WC flush valve on 3/4″; needs 1″"*).
3. **Every fixture served** — the *strays* row: fixtures with a WSFU and no
   run (the *Attach to nearest run* rescue clears it).
4. **Scale set on every water sheet** — the same rule duct has.

Manual rows (tickable while bidding, persisted with the bid): *Pressure
available checked (Appendix E)* (the self-upgrading candidate once the
critical-path math exists), *Backflow at hose bibbs and equipment*,
*Water heater sized for the load*, *Recirculation where the code asks*.
The export gate is the one duct has — the badge, the corner toast,
*Review · Export anyway* remembered until the set changes.

## 5. Where it lives in the app (seams, not new surfaces)

| Surface | Reuses | New |
|---|---|---|
| Counter Create / Quick Count / settings | the CFM field's disclosure, chip, per-mark override modal (`duct-suggest.js`) | a `wsfu` field; the name → WSFU prefill |
| Quick Line + line-type details | the raceway/airside pattern (`lineType.waterSide`) | Hot / Cold picker |
| Tracing | the cursor chip, `S` popover sections (`registerDuctPopoverSection`), attachment + leaders, downstream walk (`duct-model.js`) | a water-model twin of the downstream walk over quickLines/polylines |
| Sidebar | Line Types rows | a WSFU / gpm / velocity readout per water run; the ⚠ tag |
| Schedule | the Duct Schedule modal, its knobs foot, Copy Schedule | the Water Sizing table |
| Bid Check | `bid-check.js` auto/manual rows, the gate | the four rows above |
| Exports | report.js tables, the `--- Duct ---` block writer | `--- Water sizing ---` |
| Rulebook | `content/rules/plumbing/*.md`, `build:rules` checks | six rules (§2) |

Data rides existing objects (the AGENTS rule): a counter's `wsfu`
(+ `wsfuOverride` on a mark), a line type's `waterSide`, the project's
`occupancy` and the two velocity caps in project settings; every one in
save/load, export/import and the Artboard for free.

## 6. Suggested build ladder (after the mockup round)

> **Rung 0 shipped 2026-09-18 (punch row BEND-FITTINGS, Robert's ask):** *fittings from
> bends.* A line type's details carry a table (bend nearer 45° → fitting × qty, nearer 90° →
> …, drop at an end → …), off by default, defaults from the type's name; every run of the
> type then derives its 45s, 90s and drop-90s from its own vertices and drops as child-count
> rows (fitting-model.js, features/child-counts.js), never marks, with a chip at each bend on
> the canvas and a Bid Check row beside the hangers row (na while off everywhere, warn when
> some pipe types count and others do not). Tees and wyes wait for rung 3's attachment model,
> where a branch meeting a main is a tee for free. The edit-mode vertex override shipped the
> same day (punch row BEND-OVERRIDE, features/bend-override.js): right-click a vertex while
> editing the run for "No fitting here" / "Count as 45" / "Count as 90" / "Read from the angle",
> written to `points[i].fitting`. Mockup: https://claude.ai/artifact/6Gj27nuq1uYh9BZjeSPm82.

1. **Rulebook slice** (§2) — six rules with `code:` pointers, checked by
   the walkthrough; the project occupancy toggle beside the edition.
   **Shipped 2026-09-23** (the status block above).
2. **Fixture units on counters** — the field, the prefill, the chip, the
   per-mark override; nothing else changes yet (an estimator can already
   read total WSFU per sheet in the Summary). **Shipped 2026-09-23.**
3. **Water side on line types + attachment** — Hot/Cold, fixtures attach,
   leaders paint, the strays rescue; the sidebar readout shows WSFU served
   per run. **Shipped 2026-09-23.**
4. **The S moment** — downstream WSFU → gpm → size at the cap; the chip and
   the popover suggestion; "a size change is a new run from here." **Shipped 2026-09-23.**
5. **Water Sizing schedule + exports** — the table, its knobs, Copy
   Schedule, the `--- Water sizing ---` block, report table. **Shipped 2026-09-23.**
6. **Bid Check rows + gate**; the guide + a fourth tour step set
   ("Size the branch at S") in the plumbing walkthrough. **Shipped 2026-09-23.**

Each rung is one topic branch on the house loop (targeted specs +
`npm run check` per unit, the full suite at push checkpoints, a live walk
before the ladder is called done — the DUCT-PLAN discipline).

## 7. Worked example (the sample plan, for the mockups and future specs)

Women 108 on `sample-plan.pdf` (the design-build sample plan, since 2026-09-14), public occupancy. Illustrative values —
the slice transcribes the real ones:

- 3 lavatories on the north-wall counter, on one cold branch. Lavatory (public)
  ≈ 1.5 WSFU cold each → **4.5 WSFU** at the branch root → demand curve
  ≈ **4 gpm** (flush-tank column). Cold cap 8 fps: 1/2″ PEX (ID ≈ 0.48″)
  runs ≈ 7 fps ✓ → *suggests 1/2″*; hot at 5 fps on the same three lavs
  (≈ 1.5 hot each) → 1/2″ ≈ 7 fps ⚠ → *suggests 3/4″ @ 3.2 fps*.
- Add the 3 water closets in the stalls on the south wall (flush tank, public ≈ 2.5 cold each) upstream:
  **12 WSFU** cold → ≈ 8 gpm → 1/2″ ≈ 14 fps ⚠, 3/4″ (ID ≈ 0.68″) ≈ 7 fps ✓
  → *suggests 3/4″*; the branch to the lavs steps down to 1/2″ after the
  last WC — "a new run from here."
- Bid Check: with the lav branch left at 1/2″ hot, row 1 reads *"Lav
  battery hot: 1/2″ at 7.1 fps ⚠ → 3/4″ 3.2 fps ✓"*; attach the fourth
  lav and row 3 clears.

## 8. Telemetry (the day-7 line, again)

`water_run` (segments, WSFU served, gpm, size, side, suggestionTaken) on
commit; `wsfu_prefill` (accepted / overwritten) on counter create;
`bid_check_row_state` already carries the rows. The same read-only pull
DUCT-PLAN got on day 7.

## 9. The mockup round — what the walkthrough must decide

The six artboards (the "Water Sizing" artifact) walk the restroom end to end (drawn against the old sheet's Men 105; the design lesson runs on Women 108).
Questions, in the order they change the build:

- **Q1 — one size per run.** ☑ *New run from here.* Is "taking a smaller size at S ends this run
  and starts the next" how a plumber thinks about a stepped main, or does
  the trace want size segments like duct? (Segments cost the line model,
  every export and the specs; the answer decides ladder rung 4.)
- **Q2 — the cap, not the pressure.** ☑ *Ship the cap; the pressure check is Bid Check's.* Is a velocity-capped size the number
  you would pencil in, with the Appendix E pressure check as a Bid Check
  row — or is a suggestion without the pressure math not worth showing?
- **Q3 — occupancy.** ☑ *Project default + per-counter flip + per-mark override.* One project-level private/public toggle, or per
  counter (a private lav and a public lav on one job)?
- **Q4 — hot and cold as line types.** ☑ *Side on the line type.* Two line types per size and
  material (*3/4in PEX hot*, *3/4in PEX cold*) versus a side flag on the
  run: which keeps the Line Types list readable on a real bid?
- **Q5 — the chip's words.** ☑ *Size first; gpm in the popover.* *"6 WSFU downstream · 5 gpm · suggests 3/4″
  @ 5 fps. S accepts"* — is gpm noise to an estimator, or the number they
  trust?
- **Q6 — what stays out.** ☑ *Water first, DWV next.* Drainage next, or is DWV the half a plumber
  actually wanted first?

Decisions landed in this file's status block on 2026-09-14, the way DUCT-PLAN's did.

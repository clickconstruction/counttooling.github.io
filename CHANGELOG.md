# ClickCount — Implementation History

This file is the home for historical/implementation detail that used to live
inline in [AGENTS.md](AGENTS.md). For *current* behavior, read
[AGENTS.md](AGENTS.md) (conventions) and [ARCHITECTURE.md](ARCHITECTURE.md)
(feature catalog + code map). The base spec is [RECONSTITUTE.md](RECONSTITUTE.md).

The bulk below is the "Sync hardening" work — a series of PRs that made cloud
auto-save / manual-save / Turn In / checkout robust against flaky networks,
wedged `supabase-js` clients, clock skew, and multi-tab/multi-user hazards. PRs
are listed in numeric order (note: there is no separate PR 4 — the "Checkout
expired recovery UX" work occupies that slot).

---

## feat(water): rung 6, Bid Check rows, the gate, the guide and the tour (2026-09-23)

Punch row P4-WATER, the last rung of [WATER-PLAN.md](journeys/plans/WATER-PLAN.md) §6,
stacked on rung 5. The ladder Will chose on 2026-09-14 (fixture-unit sizing, IPC first,
water only) is built; the row closes.

- **Bid Check** ([features/water-bidcheck.js](features/water-bidcheck.js)) gains five auto
  rows once a project has a water run, water-model's `WATER_BID_CHECK_ROWS` over the
  schedule: *Every water run sized for its fixture units* (an over-the-cap run named with
  the size that passes, unsized types named), *Fixture supply minimums* (a run under a
  directly-served fixture's Table 604.4 minimum: "WC flush valve on Cold main (3/4″); needs
  1″"), *Every fixture served* (the strays per side, with the fix), *Water service at least
  3/4″* (a run named *service* or *meter* under IPC 603.1, na until one is named;
  `plumb.water.distribution-min` goes applied) and *Scale set on every water sheet*; and
  four manual rows (pressure available checked per Appendix E, backflow at hose bibbs and
  equipment, water heater sized, recirculation), ticked like the duct ones.
- **The gate.** The duct export gate's scope now includes a project with water runs: the
  badge on Copy to /Tooling and Export PDFs, the "Review · Export anyway" toast and the
  acknowledgment memory serve water unchanged; the water schedule's copy toast carries its
  own ⚠ count, so the advisory stays quiet there.
- **The tour.** The plumbing walkthrough's fourth step set, *Size the branch at S*: give the
  1in PEX its water (Cold), the lavatory its fixture units (the table's 2), trace the main
  from the riser as a polyline and take the 3/4″ the card offers at S, the next run starting
  from the last click. Each step has its zones, check, hint and a do-it-for-me action.
- **The guide.** The plumbing takeoff guide names the rows and the gate.
- **Telemetry** (§8): `water_run` (side, size, material, segments, the load and flow at the
  run's head, whether the S moment sized it) on every committed water-sided polyline and
  `wsfu_prefill` (accepted or overwritten) on counter create, behind the `water-telemetry`
  feature flag until migration `20260923190000_log_user_event_water.sql` is on prod (punch
  row WATER-TELEM applies it and flips the flag).

[water-bidcheck.spec.js](water-bidcheck.spec.js) walks the rows, the ticks, the badge, the
toast and the report; tutorial.spec.js walks the new steps with the rest of the plumbing
tour. Open after the ladder: WATER-TABLES (a tester with the trade reads the six rules
against the printed IPC), WATER-TELEM.

## feat(water): rung 5, the Water Sizing schedule (2026-09-23)

Punch row P4-WATER, rung 5 of [WATER-PLAN.md](journeys/plans/WATER-PLAN.md) §6, stacked on
rung 4. The schedule prices like a bid, the Duct Schedule's twin.

- **The schedule.** One row per committed water run: the run and its type, the size read
  off the type's name, the fixture units it carries at its head (its own attached fixtures
  plus every branch tapped off it, water-model `waterDownstreamByRun`), the design flow in
  the column its fixtures call for, the velocity at that size (the bores of
  `plumb.water.pipe-id`), and the check: ✓; ⚠ over the side's cap with the size that passes;
  ⚠ under a directly-served fixture's supply minimum (IPC Table 604.4, a flush-valve WC on
  a 3/4 in branch); or unsized when the name carries no material or size. Cold and hot
  totals, and the fixtures no run of a side reaches, with the fix named (trace past it, or
  Attach to nearest run). [features/water-schedule.js](features/water-schedule.js); the
  opener is a *Water* button on the Line Types header, shown once a type has a side.
- **The knobs** at the foot stick with the project: the velocity cap per side
  (`state.waterSettings.capFps`, 8 / 5 fps from the rulebook, normalized by
  `normalizeWaterSettings` on every intake `ductSettings` rides) and the occupancy column
  (the codes blob, one writer). The foot stamps *"sized at 8 fps cold / 5 fps hot, practice
  not code; the pressure check is Bid Check's"*.
- **The exports.** Copy Schedule (tab-separated, the pre-copy scale gate); the Show Report /
  Export PDFs table; the `--- Water sizing ---` block in Copy Summary and Copy to /Tooling,
  which the paste summary reads back as its own unit ("water sizing (3 runs, 1 ⚠)").
- Four rules go **applied**: `plumb.wsfu.demand`, `plumb.water.velocity`,
  `plumb.water.pipe-id`, `plumb.water.fixture-supply-min` (their § chips head the columns).

[water-schedule.spec.js](water-schedule.spec.js) and a report.test.js case walk it. Not in
this rung: telemetry (`water_run`, `wsfu_prefill`), one migration with rung 6.

## feat(water): rung 4, the S moment (2026-09-23)

Punch row P4-WATER, rung 4 of [WATER-PLAN.md](journeys/plans/WATER-PLAN.md) §6, stacked on
rung 3. The ductulator suggestion, for water: the size an estimator would pencil in, at the
cursor, while the main is traced.

- **The card.** While a polyline of a water-sided type is traced, a card above the footer
  (the duct hint card's twin, [features/water-size.js](features/water-size.js)) reads the
  fixture units still to serve beyond the tip and the smallest size of the type's material
  under the side's cap: *"3/4″ suggested · 6 WSFU downstream · 5.1 fps · S accepts"*; *"1/2″
  holds · 6 WSFU downstream · 6.8 fps ✓"* when the run's own size passes; the flow alone when
  the type's name carries no material. The number is water-model's
  `waterDraftRemainingLoad`, the duct rule per side: fixtures of the side attached to the
  draft at or past its tip, on committed runs that branch off it (`waterChildLinks`), or
  attached to no run of the side at all; fixtures the trace has passed, and fixtures on
  unrelated runs, are served elsewhere. A flush valve among them picks the demand column.
  Placed vertices only, so the number changes on clicks, not on hover.
- **The popover.** `S` (or a tap on the card) opens it, the duct size popover's markup: the
  suggested size as a chip, the material's whole ladder with each size's velocity (✓ / ⚠,
  the run's own size marked), the flow and the column, and the note that a size change is a
  new run. Escape closes it first on the polyline ladder, costing no vertex. With nothing in
  reach S says so instead of opening Set Scale; a plain polyline keeps S as Set Scale.
- **A new run from here** (WATER-PLAN Q1). Taking a size commits the draft as it stands,
  finds or makes a line type of the new size (the name with its size swapped,
  `replaceSizeInName`: *3/4in PEX cold* → *1-1/2in PEX cold*; the side, curve and bend
  fittings carried; hanger rows re-read from the rulebook for the new size; a palette color
  no type uses) and starts the next draft at the last point in it, so drops and hangers
  count once. A size the draft already has is a no-op.

[water-size.spec.js](water-size.spec.js) walks it; the polyline, duct-tool, scale, hotkey,
bend-fittings and render-pixels specs still pass. Not in this rung: the Quick Line trace
(one segment) gets no card; `water_run` telemetry waits for rung 5's knobs.

## feat(water): rung 3, water runs and the fixtures they serve (2026-09-23)

Punch row P4-WATER, rung 3 of [WATER-PLAN.md](journeys/plans/WATER-PLAN.md) §6, stacked on
rung 2. A line type can now say which water it carries, and the fixtures counted in rung 2
attach to its runs.

- **The Water field** (—, Cold, Hot) on the four line-type surfaces: the sidebar Add Line
  Type modal, the Choose Line Type modal's Create and Quick tabs, and the line type's details
  modal. Prefilled from the name (*3/4in PEX hot*, *1/2in CW*, *Domestic cold water*) while
  the estimator has not picked; a pick wins over a later name; set-only on create, so a
  waste line keeps its shape; the details radio writes at once and — deletes the key. Shown
  on a plumbing-shaped project, or whenever the type already has a side.
  [features/water-runs.js](features/water-runs.js).
- **Attachment per side.** Every quick line and polyline of a sided type is a water run
  (water-model `waterRunsFromAnnotations`). A fixture-unit mark attaches, for each side it
  loads, to the nearest run OF THAT SIDE within the duct tap snap (12 sheet points): a
  lavatory ties to its cold run and its hot run separately, a WC to cold only. Its loads per
  side come from the table row for its name (the counter's own column, else the project's)
  scaled to the number it carries, so a typed-over 3 on a lavatory still splits half and
  half; a fixture the table does not know counts its whole number on each side it touches.
  Multiply zones ride in the loads. Derived from geometry on every read, never stored, the
  duct model's rule.
- **The leaders.** An attached side paints a dashed tie from the mark to the point on its
  run, in the run's color, under the strokes and the glyphs (canvas-draw.js, the flex-leader
  idiom); a stray paints nothing, its bare glyph is the tell. Plain renders stay
  byte-identical (render-pixels.spec.js).
- **The strays rescue.** The shared *Attach to nearest run* context row now serves water
  too: a fixture with a side no run within snap serves, and a run of that side within reach,
  is moved onto the nearest one (app.js `strayDeviceAttachTarget` asks
  `App.waterStrayTarget` after the CFM rule).
- **The readouts.** The line type row reads "cold · 12 WSFU served · 2 fixtures" under its
  name; the Lines list reads "cold · 6 WSFU" per run. `App.getWaterServed(pageIdx)` is what
  rung 4's S moment reads for the load still to serve.

[water-runs.spec.js](water-runs.spec.js) walks the attachment, the readouts, the leaders,
the zone factor, the rescue and the field on every surface; the line-type, lines, details,
polyline, chain, duct and pixel specs (39 tests) still pass.

## feat(water): rung 2, fixture units on counters (2026-09-23)

Punch row P4-WATER, rung 2 of [WATER-PLAN.md](journeys/plans/WATER-PLAN.md) §6, stacked on
rung 1. A counter now carries its water supply fixture units the way an air device carries a
CFM, and the app reads them off the counter's name.

- **The field.** *Fixture units* on the Counter modal's Create tab, its Quick Count twin and
  the counter's details modal, shown on a plumbing-shaped project (or whenever the counter
  already carries a number). [features/water-fixtures.js](features/water-fixtures.js) owns
  the three as registered forms with one rule: while the estimator has not typed in the field
  it is prefilled from the name for the project's occupancy; type over it and the counter
  keeps yours. Set-only like the CFM, so a counter with no water keeps its shape.
- **The read.** water-model's `wsfuFixtureFromName` knows the trade's names (Lav, WC, UR,
  hand sink, mop sink, 3-comp sink, EWC, DW, tub, shower, washer…) and the control words
  (flush valve, tank, flushometer tank, a 1 in urinal valve); a floor sink, a floor drain, a
  hose bibb or a water heater is not a fixture. A bare public water closet reads as a flush
  valve (10), a private one as a flush tank (2.2), a public urinal as a 3/4 in flush valve
  (5), the table's first row per column. A chip beside the field says what was read,
  "→ 2 WSFU · public lavatory, faucet" with the § chip of `plumb.wsfu.fixtures` (applied
  now, `used_by: [quickCreate]`).
- **The flip.** The chip's occupancy word is a button: it flips THIS counter to the other
  column (`wsfuOccupancy` on the counter, absent = the project's) and re-reads the table,
  WATER-PLAN Q3's per-counter flip, and in the details modal writes the counter at once.
- **The override.** *WSFU for this one…* on a placed mark's context menu, the D15 CFM modal
  twinned: a positive number is `marker.wsfuOverride`, cleared deletes the key. The sidebar
  row's hover and the details modal show "(WSFU override 4.5)".
- **The Summary.** A *Fixture units* line at the foot of the Summary totals every placed
  mark's number (override, else the counter's), multiply zones honoured, per sheet in the
  hover; it names the project's occupancy.

Counters and markers serialize wholesale, so nothing in save/load, export/import or the
Artboard changed. [water-fixtures.spec.js](water-fixtures.spec.js) walks all of it; the
counter, quick, summary, details, duct and rules specs (67 tests) still pass. Not in this
rung: the `wsfu_prefill` telemetry (§8) waits for rung 4's `water_run` so the allowlist
migration is applied once.

## feat(water): rung 1 of the water-sizing ladder, the rulebook slice and the occupancy toggle (2026-09-23)

Punch row P4-WATER, the first of the six rungs in [WATER-PLAN.md](journeys/plans/WATER-PLAN.md)
§6 (Will's 2026-09-14 sequencing call: fixture-unit sizing, IPC first, water only, all six
mockup questions decided the same day). Nothing in the app sizes a pipe yet; this rung is the
numbers and the one project setting the rest of the ladder reads.

- **[water-model.js](water-model.js)**, a pure module in the support-model mold, holds every
  number the ladder will apply: `WSFU_LOADS` (IPC Table E103.3(2), per fixture the private and
  public columns, the supply control, cold / hot / total), `DEMAND_CURVE` (Table E103.3(3), the
  flush-tank and flush-valve columns) with `demandGpm` interpolating on a straight line between
  the printed rows, `WATER_VELOCITY_CAP_FPS` (8 cold / 5 hot, design practice, not a code
  table), `PIPE_ID_IN` (PEX SDR 9, copper Type L, CPVC CTS, Schedule 40 galvanized) with
  `velocityFps` and `suggestWaterSizeIn` (the smallest size under the side's cap),
  `FIXTURE_SUPPLY_MIN_IN` (Table 604.4) and `WATER_SERVICE_MIN_IN` (603.1). The plan's worked
  example reads right off it: 8 gpm cold wants 3/4 in PEX at 7.3 fps, hot wants 1 in.
- **Six rules** in `content/rules/plumbing/` (`plumb.wsfu.fixtures`, `plumb.wsfu.demand`,
  `plumb.water.velocity`, `plumb.water.pipe-id`, `plumb.water.fixture-supply-min`,
  `plumb.water.distribution-min`), all **draft** until their app surfaces land, every one of
  their 225 values carrying a `code:` pointer into the model so `build:rules --check` fails
  the moment a number in code and its rule disagree (275 pointers checked across the book now,
  up from 50). The four table rules were emitted from the model's tables so rule and code
  started equal; the transcription itself is punch row WATER-TABLES's to check against the
  printed code, the gate the plan set before the S moment is offered.
- **Occupancy** in Project Settings, a Public | Private segment under the code editions: the
  column the fixture-unit table is read in. It rides `state.codes` as `occupancy` (so every
  intake, the export and the device default carry it for free, `normalizeProjectCodes` keeps
  only the two values) and `getProjectCodes()` resolves it to public when a project never chose.
  [codes.spec.js](codes.spec.js) walks the segment, the state, the device default and the
  hydrate shapes; [constants.test.js](constants.test.js) pins the normalizer.

Next: rung 2, the counter's WSFU field with the prefill by name and the chip.

## test(view-only): the viewer's Hide marks eye, pinned across the matrix (2026-09-22)

Punch row VIEWER-HIDEMARKS, closed with no defect found. The 2026-08-31 cloud walk left the
view-link recipient's eye "check-later" and the two specs that touched it ran as the owner.
[view-only.spec.js](view-only.spec.js) now walks it as the viewer: the desktop header eye is
there (it is not an editing tool, so `viewerHideIds` leaves it), blanks the overlay and flips its
label and `aria-pressed`; the choice is written under `view:hideMarks:<token>` and survives a
reload of the same link; on a phone the eye is consolidated into the ☰ whose Hide marks / Show
marks row toggles the same state. Everything behaved; the row was a check, not a bug.

## test(ci): the specs wait for the app's own ready signal; Playwright's quiet-network wait loses a request on a slow machine (2026-09-22)

Punch row CI-NETWORKIDLE, closed, on the third diagnosis; the first two are recorded so they are
not tried again. The flake: on CI the boot's `page.waitForLoadState('networkidle')` timed out
inside the test budget (all 19 flaky errors and the one hard failure on PR #161's five runs; the
same four tests twice on PR #169; 35 to 48 minutes a job). Wrong diagnosis one: the service
worker's precache kept the network busy. Blocked, the same wait timed out 27 times. Wrong
diagnosis two: the two-core runner is starved and the boot takes the whole budget. With a 90 s
budget the same wait timed out 25 times at 90 s, and the traces of those failures show every
request finished within seconds and the page fully loaded while the wait sat for 85 s. The cause,
reproduced on a laptop with the CPU throttled four times: Playwright's quiet-network bookkeeping
loses a request and never reports idle, on a fresh boot, one time in five (12 throttled boots:
`networkidle` hung 5, mean 14.4 s; `App.bootSettled` hung 0, mean 6.0 s). Nothing in the app is
busy; the question itself is unreliable there. So every boot wait in every spec, 311 of them,
is now `waitForFunction(() => !window.App || window.App.bootSettled === true)`: the app page
waits for its boot to settle (the signal tutorial.spec.js and lessons.spec.js already used and
never flaked on), a static page (the landing, a guide) is done at load. The four specs that boot a
view link wait for `load` instead, since that boot awaits the email gate before it settles. The
test budget is 90 s on CI, 30 s locally, so a boot that takes 6 s throttled has room on a worse
runner, and the service worker stays blocked (pwa.spec.js and the rulebook precache test opt
back in): a spec should not install what it does not test. Measured: the full suite locally, 4
workers, 787 of 790 passed in 14.5 minutes and the three that failed under that load pass alone; the CI e2e job, 2 workers, five runs on 2026-09-22, every one green: 26.1 to 36.6 minutes, 773 to 777 passed,
no failures and no flaky tests, the first clean runs since the row was opened (before: 39.7 to
47.8 minutes with 2 to 4 failures).

## fix(load): Load Project opens on the device's PDF when the cloud has none (2026-09-22)

Punch row LOAD-DEVICE-PDF, closed. A PDF upload cut short by a reload leaves the marks autosaved,
the row with no `pdf_path` (or an object that is empty or missing) and the device backup holding
the blob. The restore prompt learned to use that copy on 2026-09-20; Load Project, the door most
people use, still went straight to "This project has annotations but no PDF" without looking at
the device. features/load-project.js `loadCloudProjectRow` now asks `devicePdfIfOnlyCopy` in
both branches (no `pdf_path`; `pdf_path` but the download came back empty or missing), by the
restore's rule: the backup's blob unless both sides carry a hash and they disagree. It opens the
sheets on it (`openOnDevicePdf`), hands the copy to the engine (`state.pdfBuffer`, no
`pdfStoragePath`) so the autosave tick uploads it, takes the backup's hash when the row has none,
and marks the last save as PDF-less. No device copy, or a disagreeing hash: the canvas-only
door as before. Spec: [load-device-pdf.spec.js](load-device-pdf.spec.js), signed out against a
fake row through the registered `App.loadCloudProjectRow` (both branches, the hash conflict,
no copy). Not changed: copy-project.js's `resolvePdfBufferForCloudProject` keeps its
marks-side gate for Copy project; a copy of a project whose only PDF is on this device is a
smaller door and can follow.

## fix(lines): the run stays painted while it is edited (2026-09-18)

Edit Polyline splices the run out of the page's annotations into `state.editingPolyline`
(`enterEditMode`), so the unified draw core stopped painting its stroke the moment editing
began: the estimator saw the yellow vertex dots and, since BEND-OVERRIDE, the bend chips, but
not the segments between them. The live overlay's edit block (app.js `renderAnnotations`, the
`state.editingPolyline` branch) now paints the run's segments first, the way the draw core
does for a committed run: the run's colour, the line type settings' stroke width and opacity,
a closed run closing back to its first point, solid (polylines carry no dash style), under the
dots and chips. Live path only; the export path never sees a run mid-edit. Test: a sixth case
in bend-fittings.spec.js reads a pixel on `#annCanvas` at a segment midpoint before, during and
after editing, and at the closing segment of a closed run while edited.

## feat(tour): every button, once, on a blank sheet the tour makes itself (2026-09-21)

[BLANK-TOUR.md](journeys/plans/BLANK-TOUR.md). The fourth tour, on the other axis from the
three trade tours: no plan, no trade, no numbers to get right, and every control in the header,
on the sheet, in the footer and in the sidebar pressed once, 37 steps in about fifteen minutes.
It came out of an audit of what the tours, the lessons and the courses actually press (the table
in the plan file, generated from the code): twelve header and footer controls had never been
pressed by any step (Move, Ghost, Grid overlay, Drop sizes, Save status, Export project, Close
this project, the sidebar fold, the sheet arrows, + / Fit, Redo, Clear Page); all are now.

- **The sheet is made in the browser** ([features/tour-blank.js](features/tour-blank.js)): two
  ANSI B pages from the vendored pdf-lib, a border, a title block that says 1/8" = 1'-0", and on
  SK-1 one 20'-0" dimension to prove the scale on, fed to `#pdfInput` like a dropped file so the
  intake, the sheet-size analysis and the local backup run for real. Project `blank-sheet`;
  features/lessons.js treats it as a teaching set (reset without asking), and the tour resets the
  teaching sets the same way; the reader's own plan goes through Close project, which asks.
- **A step is one button.** Sheet work sits in the engine's circles and boundaries; a toggle is
  done only once pressed and pressed back (a latch); a dialog step holds until read. No trade
  is stamped (Fixture, Pipe, Area A), so Duct sits behind ⋯ on a plumbing device and Polyline
  on an HVAC one, exactly as on a real bid. The palette baseline is taken when the sheet opens,
  because an Artboard's counters ride into every new project, and the same baseline is the sweep on
  stop: the Fixture, the Pipe, Area A and the key binding never follow the reader onto a real bid.
  Snap to 45° is the device's and goes back on stop. The sheets name themselves SK-1 and SK-2 off the
  title block, the way a real set does.
- **Doors**: the empty canvas ("or press every button once on a blank sheet", hidden once the
  tour is done on this device: `clickcount-tour-done-blank`), Learn → Every button, Project
  Settings → Help → every button, `/app/?tour=blank`.
- **Pick up where you left off**: the step the reader is on is kept on the device and the next
  start offers **Pick up where you left off** (the sheet opens fresh with every earlier step laid
  down through the same doors, then lands on the saved step) beside **Start over**. **Precision
  where it counts**: the Quick Line step's circles are tight and its check reads the footage,
  because a run is measured between the two clicks. **Share and Copy view link** have a step of
  their own that says what they do and how to reach them for real; they stay unpressed, because
  they do nothing off a cloud project and pressing them would mean saving the practice sheet into
  the reader's account.
- **Engine** (features/tutorial.js): `?tour=<id>` resolves when the link fires against every
  registered tour; a registered tour may carry `onStart()` and `onStep(id, index)`; a step may
  carry `progress()`, the neutral status line for guidance on a step with several parts (`hint()`
  stays red for misses), and `alt`, a second action button; the card's step number no longer
  wraps under a long row of dots.
- **Walked on a tablet** (768 × 1024, touch), which found engine bugs every tour had there: the
  "narrow" test was `< 768` while the app's breakpoint is 768 inclusive (an iPad in portrait), so
  the sidebar-drawer wording and the ☰ fallback never fired; the header strip scrolls sideways
  and tools past the edge were never lit (they are scrolled in now); with no control to light the
  card sat on the sheet targets; the docked card covered the targets the engine had centred under
  it. The blank tour's steps say where each control lives on a tablet (Quick keys under Settings,
  Snap in Line Type Settings, Polyline in the sidebar, Add canvas under Layers, Hide marks, Drop
  sizes, Export and Close project under ☰, the sidebar behind ☰, zoom by pinch) and light that
  door. The walk also found an app gap: the Notes ledger's header button is consolidated away
  on a tablet and nothing mirrored it, so the ☰ (features/burger-menu.js) gained a Notes ledger
  row, gated like the button.
- Spec: [tutorial.spec.js](tutorial.spec.js) walks all 37 steps through the seam and asserts the
  real state after each; the doors; the reset over a teaching set; snap restored; a tablet
  viewport walk with touch.

## feat(duct): the grease duct's cleanouts and listed wrap are priced on their own lines (2026-09-21)

The line the grease-duct reveal used to hand to the bid is now on the Duct Schedule. When any run
carries a grease material, a **Grease duct** block sits under the flex rows, outside the bid weight:
**cleanouts** by the piece, one at each change of direction (each elbow on a grease run) plus one
per 12 ft of horizontal run (NFPA 96 7.4; duct-model.js `DUCT_GREASE.cleanoutIntervalFt`,
drift-checked from the grease-duct rule), and the **listed wrap** by the square foot of duct
surface, straight duct only, since fittings are wrapped by the piece. The block reads
"1 at a change of direction + 0 along 10' of horizontal run, one per 12'" so the count explains
itself. Copy Schedule, the copy rows Summary and /Tooling append, and the report carry both lines.
`greaseDuctExtras(runs, fittings, distFt)` is the pure seam, null on a galvanized takeoff. The HVAC
course's chapter 7 reveal now reads the block (one cleanout, 47 sq ft on the sample) and the compare
card names it; the welding labor stays with pricing.

## feat(duct): the grease duct is a real run, and the fire damper is counted (2026-09-21)

The two gaps the HVAC course named on the day it merged. A duct run now has a **material**
(duct-model.js `DUCT_MATERIALS`, D25): galvanized by default and keyless on the run, or welded
black steel or welded stainless for a hood's grease duct, from the Duct dialog's Material select or
the run's right-click menu (which also gained an Airside chip). A grease run prices on its own row
of the Duct Schedule at the gauge the code fixes (IMC 506.3.1.1: 16 ga carbon steel, 18 ga
stainless) and that metal's sheet weight, its fittings the same way, and the per-size gauge override
never reaches it; the sidebar, the schedule, the copy rows, the report and the canvas chip all name
the metal. New rule page: [grease-duct](content/rules/hvac/grease-duct.md), drift-checked against
the table. The HVAC Quick tab has a **Fire Damper** type (the Fire/Smoke Damper symbol).

- **The set**: M-101 draws the grease duct darker from the hood collar to a roof curb, sloped with
  a cleanout at its elbow, and dots the kitchen's hall wall as 1-hr rated with an FD at each of its
  two duct penetrations (the kitchen branch, and the main above the kitchen door). The legend and
  keynotes say so, and that nothing goes in the grease duct.
- **The course**, chapter 7: trace the grease duct with its material (a galvanized trace is sent to
  the run menu), read what the Schedule did with it, count a fire damper at each penetration (a wall
  that is not rated is refused with the keynote), and why the grease duct would still get none.
  Chapter 9 ticks the fire-damper row as a count you can defend. The reference grew to 26 marks and
  a ninth duct row.
- Specs: course-hvac.spec.js checks the grease row (16 ga, 11.78 lb/ft, 10.1 ft, its elbow in black
  steel), the two dampers, both refusals; duct-model.test.js covers the material end to end.

## feat(course): the HVAC course, nine chapters on how a restaurant gets its air (2026-09-21)

[HVAC-COURSE.md](journeys/plans/HVAC-COURSE.md). The third course, the same way as the two before
it: the engineer's drawing is the answer key, a question is answered with a click the check refuses
when wrong, and this time the app's arithmetic carries most of the teaching, because the HVAC side
already knows a room's air, a system's capacity, a run's gauge and pounds, and whether it fits the
roof and the fan.

- **The set** (scripts/sample-hvac.js, `npm run build:sample-hvac`): M-101 the mechanical plan on
  `restaurantShell` (24 devices tagged by the schedule with their flex dashed, the main drawn at
  width with its size printed where it steps and a 2" wrap, four branches, the restroom exhaust, the
  hood's grease duct and its keynote, the roof equipment keyed outside the east wall), M-501 the
  equipment, diffuser and room air schedules, M-601 a building section at 1/2" = 1'-0" with the
  wrapped main dimensioned in the plenum.
- **The course** (features/course-hvac.js): which unit moves the most air (the hood fan, not the
  RTU), which room breathes hardest and why, rooms boxed with the schedule's type and CFM and the
  deck height, the palette from the diffuser schedule with a CFM per tag and 24 devices placed by
  tag, why the kitchen necks are bigger, RTU-1 as a system with its capacity and ESP and why 3,000
  for 2,650, the main traced at 24×12 stepping at S where the plan prints it, the diffusers hung on
  the runs and what that changes, the fittings the run counted for itself, the section measured and
  *Fits the roof* answered by the deck height, *Static path* read as a lesson in ESP, the grease duct
  noted (NFPA 96) and why it stays out of the gauge table, the restroom exhaust as an exhaust run,
  make-up air and the interlock, the whole set against a reference by size with the bid weight, the
  duct rows of Bid Check with the ones the set already answers.
- **Runs laid through the model.** Seeds lay a run with duct-model's `makeDuctRun` and
  `App.reinferDuctFittings`, synchronously, because the lesson kit seeds before it switches the page;
  the reader traces by hand with the tool. Attach is its own step: a diffuser counts toward a
  system's designed air and the static path only once a run reaches it.
- The Learn menu holds three sections; the empty-canvas line offers "plumbing or its power or its
  air"; Project Settings → Help has all three.
- Specs: [course-hvac.spec.js](course-hvac.spec.js), twelve tests: every chapter through the seam
  with the numbers its bodies quote (the main 32.5 / 11.67 / 10 ft by size, designed air 0 before
  the runs and 2,350 after, the plenum's two rows auto and ok, the exhaust 27.58 ft of round), the
  wrong roof key and the wrong grease duct refused, the main traced at the wrong sizes named, the
  doors and three courses in one menu.
- Open: HC-REVIEW, a trade read of chapters 2 to 7 and M-501's numbers. No fire dampers (no rated
  wall in the set), the grease duct is a note not a run, chapter 9 says so.

## feat(course): the electrical course, nine chapters on how a restaurant gets its power (2026-09-21)

[ELECTRICAL-COURSE.md](journeys/plans/ELECTRICAL-COURSE.md). The plumbing course's sibling, built the
same afternoon, the same way: the engineer's drawing is the answer key, a question is answered with
a click the check refuses when wrong, the explanation and its section on the next card, and this
time the app's own arithmetic teaches too.

- **The set** (scripts/sample-electrical.js, `npm run build:sample-electrical`): the same Main St
  Restaurant as P-101 on the same shell, which was factored out of P-101's drawing as
  `restaurantShell(opts)` (lights, plumbing tags and drains as options; P-101 proved unchanged element
  for element). E-101 the power plan, E-201 the lighting plan with every fixture's letter beside it,
  E-501 the fixture and panel schedules, E-601 the one-line. Every device sits at a P-101 coordinate.
- **The course** (features/course-electrical.js): which receptacles must be GFCI (NEC 210.8(B), a
  duplex clicked as one is told it has no sink within 6 ft, and the one the engineer drew plain in the
  kitchen has to be found and flagged), the working clearance measured in front
  of LP-1 (110.26), the dishwasher's row highlighted and read (240.4(D), 310.16), the palette from the
  fixture schedule and 36 fixtures placed by the letter, the fixtures with a battery (700.12, IBC
  1008), occupancy sensors (IECC C405.2.1), a raceway that knows its conductors and the chain that
  writes the verticals, fill judged against Chapter 9 Table 1, the voltage-drop row warning at the
  default 12 A and clearing at the 6 A the engineer scheduled (210.19 informational note), the
  three-phase J-box found, the shunt-trip RFI, the feeder traced with 4 #3/0 + #6 G and judged for
  fill, the whole set against a reference of 69 marks and three runs, the circuit schedule in the
  report, the electrical rows of Bid Check.
- **The lesson kit opens a named set** (`lesson.set` in features/lessons.js: url, name, page count,
  trade), so the plumbing set stays four sheets. **The Learn menu holds a section per course**
  (`App.courseSections`; the plumbing section moved to `#learnCourseList-plumbing`). The empty-canvas
  line offers "plumbing or its power"; Project Settings → Help has both. The plumbing course's
  ARCHITECTURE row, lost in the targets merge, is back.
- The schedule reader's descriptions also stop at a bare integer column (volts, watts).
- Specs: [course-electrical.spec.js](course-electrical.spec.js), twelve tests: every chapter through
  the seam with the numbers its bodies quote (the chain 60.5 ft with four 9.5 ft verticals, the
  homerun 84.17 ft, the feeder 12.33 ft, fill on the feeder in the thirties), the wrong GFCI click
  refused, the voltage-drop row's warn-then-clear, the doors and both courses in one menu.
- Open: EC-REVIEW, a trade read of chapters 2 to 7 and the panel schedule. Fire alarm is absent from
  the set on purpose; chapter 9 says so. The HVAC course is next.

## feat(course): the plumbing course, nine chapters on how a restaurant gets its plumbing (2026-09-21)

[PLUMBING-COURSE.md](journeys/plans/PLUMBING-COURSE.md). The owner's ask: "a short tutorial, and a long
tutorial where we use the opportunity to coach the user how plumbing, electrical and HVAC work, and
the rules, and why things are where they are." The short one is the tours and the lessons; this is
the long one for plumbing, built first because only plumbing has an engineered sheet. Decisions:
plumbing first, the engineer's drawing is the answer key, the drawing may change to teach better.
Two rounds the same day: a first cut, an honest "is this the best we can do" (no: the coaching told
with a delay, the drawing was thin, the app's unique features were mentioned not used), and the
rework below.

- **The course** (features/course-plumbing.js) is nine chapters on the tour engine, each the length
  of a lesson, resumable, ticked on the device: Read the sheet, The fixtures and where they sit,
  Water, Waste and vent, The riser, Gas, The enlarged plan and the typical, The whole sheet, Check
  it and hand it off. It runs on the lesson set and reads `App.lessonKit` (features/lessons.js, now
  exposed) at call time; chapters stand alone the way lessons do. Merged onto the on-sheet targets
  engine the same day: every sheet step declares its circles or boundary and counts only inside
  them, a QUESTION step deliberately draws none (a circle on the answer would be the answer), and
  each step's action is the engine's seam, `App.tutorialDoStep`, for the spec and the finish button.
- **A question is answered with a click.** "Which hand sink serves the cook line?" passes only on
  the sink by the range and tells a wrong click which sink that was. "Put a note on a fixture whose
  waste must never enter the interceptor" passes on a water closet, a lavatory or the mop sink and
  says a hand sink carries grease. "Where must a cleanout be?" counts four and names the missing
  ones by room. The explanation, with its section (IPC 604, 608, 704, 708, 709, 710, 802, 901, 903,
  1002, 1003; FDA Food Code 5-202.12 and 5-204.11; IFGC 402 and 409.5; NFPA 96), opens the next
  card. Where nothing can be clicked, the engine's `reveal` holds the answer behind "Show the
  engineer's answer". Every count step's hint names what is still missing, by room.
- **The app's own features do the work**: the schedule reader builds the eight counters from P-501's
  table (chapter 2), the waste goes on its own layer (chapter 4), the hot water return is traced as
  its own type, the FD counter carries a Trap primer child count, Summary Legend, Export PDFs and
  the notes ledger each get a step.
- **The whole sheet, against a reference** (chapter 8): "Finish the takeoff for me" lays every fixture
  and every run; the reference is computed from the same flat geometry (seven line types, twelve
  counts, thirty-four marks) so it cannot drift from the drawing; the compare card is a body that
  is a FUNCTION, rendered live, with the reader's feet beside the reference's and the run a short
  one is missing.
- **The drawing**: P-101 gained its waste side (a 4" sanitary line under the restrooms that joins the
  sewer DOWNSTREAM of the interceptor, a 3" grease line from every kitchen, dish and bar fixture,
  four cleanouts, two VTRs, an RPZ, a hose bibb, general notes naming materials and slope) and a
  hot water return with its own dotted line; P-501 gained WSFU and DFU columns and a note adding
  the drainage load to 47 DFU against a 4" sewer's 180 and a 3" sewer's 36; **P-601 is new**, the
  restrooms' waste and vent riser as an elevation at 1/4", to scale, so a trap arm can be measured
  against Table 1002.2 and the stack traced from the drain to a foot above the roof. Nothing that
  was on P-101 moved (the tours' and lessons' specs ran unchanged); the one dimension string that
  lied, 36'-0" over a 35'-10" wall, says what the wall measures. The lesson set is four sheets.
- **Engine** (features/tutorial.js): `reveal` / `revealLabel`; a body may be a function; `cardAt`
  places a card with no control.
- **Three small product changes**: a tag may carry a hyphen or lead with a digit (tag-model.js
  `TAG_RE`, so WC-1 and 3CS-1 read as tags; the unit test grew); the schedule reader's link is
  offered on plumbing projects too (features/tag-reader.js); Copper and PVC join the Quick creator's
  default materials (constants.js `LINE_DEFAULTS`).
- **Doors**: the Learn menu's third section (progress, ticks, the next chapter lit; the card scrolls
  as one region now), the empty-canvas "plumbing course" link, Project Settings → Help,
  `/app/?course=plumbing`, `/app/?chapter=plumbing:<id>`. The learning guide lists the chapters;
  the plumbing guide points at the course.
- Telemetry rides `tour_step` (`tour: 'course:plumbing:<id>'`). No new event type.
- Specs: [course-plumbing.spec.js](course-plumbing.spec.js), fourteen tests: every chapter's path
  end to end on real state with the numbers its bodies quote (the trunk 99.17 ft with its riser,
  ten hangers and three 90s; the return 40.42 ft; the sanitary line 66.25 ft and the stack 17 ft;
  the gas 35.5 ft with one 90 and four drops), the wrong click refused with its hint, the schedule
  reader's eight tagged counters, the reference and the live compare card, the doors, the reveal.
  teaching-labels.test.js reads the course file too, which is why its point lists are flat.
- Open: PC-REVIEW on the punch list, a trade read of chapters 2 to 6 before the course is offered on
  the landing. The electrical and HVAC courses wait on E-101 and M-101. Fixture-unit sizing in the
  app (WATER-PLAN) would let chapter 3 confirm the engineer's sizes instead of reading them.
## fix(boot): the boot no longer outruns the feature scripts (2026-09-21)

Found chasing a CI failure on the on-sheet targets PR. app.js's async boot calls into
features/*.js (`App.openLastSessionRestorePrompt`, `App.initViewOnlyMode`), and those scripts sit
AFTER app.js in the shell. The boot normally loses that race, but with a warm cache and a quick
IndexedDB read it can win, and then a reload onto a device holding a saved session threw
"App.openLastSessionRestorePrompt is not a function": the boot died before `updateUI`, the saved
session was never offered, and the page never went network-idle. Timing-dependent, so it showed up
as scattered 30 s `waitForLoadState` timeouts across unrelated specs in CI (5, 13, 19 and 22 flaky
tests on four runs this day) and, locally, in two of three reloads after a tour.

`shellScriptsReady()` resolves at DOMContentLoaded, by which point every classic script has run;
the boot awaits it before the view-link path and before the silent pre-apply. It sits BEFORE the
pre-apply on purpose: the pre-apply-to-offer stretch must stay free of awaits so no backup write
can interleave. Spec: restore-last-session.spec.js "BOOT RACE" serves the feature file 1.5 s late
and expects the offer; it fails without the fix. The three whole-tour specs also got the 90 s
budget their siblings have.

It was NOT the main source of the CI flakes, though: the next run still had 16. Every one of
them, and the run's one hard failure, was `page.waitForLoadState('networkidle')` timing out. A
fresh context installs the service worker and precaches about 155 files, so a slow runner's
network does not go quiet inside a test's budget. tutorial.spec.js now waits on the app's own
signal (`App.bootSettled`) the way lessons.spec.js always has (zero flakes across the runs);
the rest of the suite is punch row CI-NETWORKIDLE.

## feat(learn): the reader does every step, inside targets drawn on the sheet (2026-09-21)

The owner, after a morning with Learn: "Instead of being able to click through it, I would like
circles on the page, or boundaries, where a user has to do those actions within those boundaries.
The boundaries could be quite gracious, and they also clarify where the user should make those
actions." Mocked first, then built for all sixteen walkthroughs (the thirteen lessons and the
three trade tours).

- **Targets on the sheet.** A step that works on the plan declares `zones` in the sheet's own
  points: a **circle** on each thing to click, a shaded **boundary** around anything to drag a box
  over (with the thing it must wrap dotted inside). They are drawn over the plan in `#tourZones`
  (an SVG that never takes the pointer, redrawn every frame from the sheet canvas's own box, so it
  rides pan, zoom and resize with no hook into either), numbered, and turn green with a tick as
  each is satisfied.
- **The check counts only what is inside.** `markZones` gives each mark to its NEAREST circle, so
  close fixtures never both light from one click; `boxZone` wants a box that holds the inner
  rectangle and stays inside the outer one; `pathZones` wants a corner in each circle in order and
  ticks them while the trace is still in progress. Measure steps keep their true test, the
  reading, with circles on the two tick marks. A miss is named on the card in plain words ("A
  mark outside the circles does not count. Press Ctrl+Z…", "That box misses part of what it should
  wrap…", "That drop is on another end…") and nothing is ever deleted for the reader.
- **Gracious by construction.** A circle is a foot or two of plan and never under 26 px on screen
  (`zoneR`: the radius that counts is the one drawn). On entering a step whose targets would draw
  small or off screen, the sheet zooms to them once (`focusOnZones`, never past 3x, never under
  the fit): the plumbing tour's water closets are 30 pt apart and now arrive at 292%.
- **The card no longer does steps.** "Do it for me" is gone. **Show me where** pulses the target
  or the lit control (and turns to the target's sheet). **Next** is disabled until the step is
  really done; a quiet **Skip this step** link keeps anyone from being stuck and logs
  `tour_step { skipped: true }`. The one exception is a step nobody can do by hand, `handsOff`
  (fetching the sample sheets): its button still does it. Each step's `action.run` survives as a
  spec and screenshot seam, `App.tutorialDoStep()`, with `App.tutorialStepInfo()` and
  `App.tutorialZoneScreen()` beside it.
- **The card keeps off the targets**: it takes the first viewport corner that covers none of them
  (it sat on circle 1 of the prove-the-scale step), and while targets show the spotlight's dim
  drops to a veil so the drawing under a boundary stays readable. Its buttons are two rows now.
- Specs: by REAL clicks, a click outside a circle does not advance and says why while one well
  off-centre inside does; a half box is refused and a wrapping one passes; a trace ticks its
  circles corner by corner; the plumbing tour's circled water closets and its typical-floor
  boundary (tutorial.spec.js, lessons.spec.js: 35 tests with restore-last-session).
## fix(legend): the corner grip sizes the legend, smaller as well as bigger (2026-09-21)

Grace's field report: "you can move it but can't shrink it." The legend's bottom-right grip
set the box's width and height with a floor at the rows, so dragging inward snapped back and
dragging outward grew a bare white patch past the rows. The Summary Legend dialog's size
slider did shrink the block, but nobody looks for a slider when there is a grip, and its
50% floor on a D sheet (the legend follows the sheet since 2026-09-19, about 2× there) only
got the block back to where it had been.

- The grip scales the legend as a whole: the pointer's travel along the box's diagonal
  multiplies `legendSettings.legendScale`, the same knob the size slider sets (the slider
  reads the drag when the dialog opens next). Inward shrinks, outward grows, and the rows
  follow; the box always hugs its rows in drawLegend. `userResized` is retired: a box an
  older save grew past its rows snaps back to them. The range is 25%..400% in both places
  (`LEGEND_SCALE_MIN` / `LEGEND_SCALE_MAX` in constants.js; the slider's floor came down
  from 50).
- Undo puts the size back: the full undo snapshot carries `legendSettings` (the grip pushes
  one at the press, as it always did, but the box it restored no longer decided the size).
- Every knob on the Summary Legend dialog marks the project dirty now; only the style
  segment did, so a size or opacity change alone was never saved. The sliders mark it once,
  at the release.

canvas-draw.test.js pins the box at half and twice the scale and the snap-back of a legacy
oversized box; [legend-resize.spec.js](legend-resize.spec.js) drags the real grip both ways,
undoes, and reads the slider.

## fix(turn-in): the edit button holds a beat after it acts (2026-09-21)

Punch row **R1-RECLICK**, decided and closed. `[Check out to Edit]` and `[Turn In]` are one button
in the same pixels of the header (and its copy in the sidebar), and the label flipped the instant
the first action landed, so a second click undid the first: checked out, then turned straight
back in. The field report's pair was 16:36:01 then 16:36:04, a second click by someone who had
not seen that the first one worked. The decision: a brief hold, no confirm on Turn In (a confirm
would tax the many deliberate turn-ins a day to stop a mistake that is cheap to undo).

- After a checkout or a turn-in succeeds FROM THE BANNER, it reads **"Checked out ✓"** or
  **"Turned in ✓"**, disabled and in the quiet colour, for 3 s, then offers the opposite action as
  before. Three seconds because the reported second click came three seconds later; nobody checks
  out and turns in on purpose inside that.
- features/turn-in.js owns it: `holdEditBanner` after a successful action,
  `App.applyEditBannerHold(bannerEl)` called by updateUI (app.js) just before the sidebar copies
  the header's markup, so both banners hold alike. updateUI rebuilds the banner on every call, so
  the hold is re-applied each time and a timer's updateUI ends it.
- Only the held action is held. A project turned in here and checked out again from the admin
  notice or Project Settings offers a working `[Turn In]` at once (the first cut swallowed every
  banner click during a hold; turn-in-self-release.spec.js's new timeout report named it on its
  first run). Expired, Unsaved / Save and "someone else is editing" are never held. Project
  Settings' own Check Out and Turn In are separate buttons and are unchanged.

reclick-hold.spec.js (cloud-gated): a double-click on each label acts once and the state stays; a
click two seconds into the hold does nothing; the sidebar holds too; the hold ends by itself.
Gates: that spec with turn-in-self-release, close-project, save-status, header-strip-trade and
view-only, `npm run check`.

## feat(learn): Learn, thirteen short lessons for every part of the app (2026-09-21)

LEARN-LESSONS and LEARN-FLIP, phases 3 to 5 of [LEARN-PLAN.md](journeys/plans/LEARN-PLAN.md). The
owner's ask: "a tutorial where they can go through and use all parts of the app."

- **Learn** is a menu (`#learnModal`) of thirteen lessons, two or three minutes each, beside the
  three five-minute trade tours: Sheets, Scale, Counting, Measuring, Chain and child counts,
  Repeats, Organizing, Fixing mistakes, Notes and questions, Check and prove, Deliverables, Working
  faster, and a guided read of the cloud half (a lesson cannot run on a cloud project). Same engine
  and the same rules as the tours: every step checks REAL state, every doing-step offers Do it for
  me through the app's own doors, controls are named as they look on screen.
- **Doors**: "every tool, one short lesson at a time" on the empty canvas, Project Settings → Help →
  lessons, `/app/?learn=1`, and `/app/?lesson=<id>`. Thirteen guides gained a **Try it** line that
  opens their lesson; the plumbing guide links two.
- **The lesson set**, `samples/sample-lessons.pdf` (`npm run build:sample-lessons`): the engineered
  sheet could not teach pages, a second scale, a scale zone or a typical, so two sheets were drawn
  for the purpose. P-401 has the restrooms at 1/4" with 12'-0" strings to prove it, and a hand sink
  station detail at 1/2" that is TYP. OF 4 with a 4'-0" string inside it; P-501 is the fixture
  schedule scanned sideways. The engineered sample plan and the hero films are untouched.
- **A lesson stands alone and costs nobody their work.** Its first step opens the sheets fresh and
  seeds what it takes for granted; over the reader's own plan that goes through the app's one Close
  project question, over the last lesson's sheets it just resets; a lesson's palette items are swept
  before the next, an Artboard palette is left as it was. A finished lesson is ticked on the device
  (`clickcount-lessons-done`) and hands back to the menu with the next one lit.
- **Shipped on, not behind a flag.** The plan staged it behind `?ff=learn` with a flip to follow.
  The owner approved turning it on, the whole path is pinned by spec, and the feature is additive
  (two links and a dialog), so the dormant stage bought a second 34-minute CI run and nothing else.
- **Engine** (features/tutorial.js): `App.registerTour`, `App.tourKit`, `onStop`, links in step
  bodies, and three fixes found by walking the lessons: the card sat ON the button it pointed at
  (Trim your set's Open), so it now tries right, below, left, above, then the far corner, takes the
  bottom-left when the sheet itself is the target, honours a step's `cardAt`, and drags by its head;
  two rasters back to back on a page switch left the sheet blank, so a lesson lands with one.
- **An app bug found on the way**: a dialog's × re-dispatches Escape on `document`, and the keydown
  handler called `e.target.matches` on it: a console error on every × of a dialog with no Esc rung
  (the proof breakdown, Export PDFs). Guarded.
- Telemetry rides `tour_step` (`tour: 'lesson:<id>'`), so there is no new event type and no migration.
- Specs: [lessons.spec.js](lessons.spec.js), 16 tests: each lesson's do-it-for-me path end to end with
  the takeoff it claims (the gas main reads 39.5 ft with two 90s; the zone's 4'-0" reads 4'-0" on a
  1/4" sheet; one mark reads 4 under a x4 zone), the doors, the reader's plan, the card.

## docs(guides): the plumbing, electrical and HVAC guides follow their tours (2026-09-21)

LEARN-GUIDES, phase 1 of [LEARN-PLAN.md](journeys/plans/LEARN-PLAN.md). Every claim was walked in
the app first; every picture is the takeoff the trade's own tour builds.

- **Plumbing** is rewritten end to end around what its intro always promised: prove the scale,
  count, Chain a battery, Drop for the risers, hangers from the rulebook with the § IPC 308.5 chip,
  Fittings from bends and the vertex menu's "No fitting here", multiply and scale zones, RFI notes
  and Copy RFI Flags, the plumbing Bid Check rows, the proof breakdown, the hand-off.
- **HVAC** no longer says to trace duct with Line and Polyline. It is rooms and CFM targets, air
  devices that carry their CFM, a system with a capacity, the Duct tool sizing itself at `S`,
  strays and Attach to nearest run, fittings that count themselves, the Duct Schedule and Bid
  weight, Bid Check and the export gate, the compact M-sheet legend, and the Duct block in
  Copy to /Tooling. The long form stays in duct-takeoff-by-the-pound.
- **Electrical** gains the tour pointer it never had, Fittings from bends, the § chips and code
  edition, the compact E-sheet legend (the old sentence said a tally), and a Bid Check picture
  with the warning the tour really ends on: three counted receptacles on no run. The tour's Bid
  Check step now says what the reader sees there rather than what the section can do in general.
- All three link straight into their tour (`/app/?tour=<trade>`).
- `scripts/build-screenshots.js` gains `tourSetup(tour, stopAt, after)`: a shot that presses
  "Do it for me" through the tour and frames the result, so a tour change re-shoots its guide.
  Six new shots. `[[chain]]` and `[[drop]]` join the guide icon shortcodes.

## fix(tutorial): a tour starts clean, leaves no dialog over its next step, and fits a phone (2026-09-21)

LEARN-ENGINE, the engine half of [LEARN-PLAN.md](journeys/plans/LEARN-PLAN.md). All four were seen
in a live walk, not read off the code.

- **A `?tour=` link no longer gets the restore offer on top of it, or the last tour's marks inside
  it.** Three holes, one cause: a tour link starts the tour 600 ms after load, and the boot did not
  know one was coming. `App.isTutorialPending()` covers that gap; the restore offer's blocker and
  the boot's silent palette pre-apply (`bootSessionBusy`) both read it. And
  `maybeReapplyLocalBackupMarks` (features/pdf-intake.js) stands down while a tour runs: every tour
  opens the same sample PDF, so the last tour's backup hash-matched it and its water closets landed
  in the HVAC tour. The offer still comes when the tour ends, as before.
- **Entering a step closes the dialogs the last one left open** (`closeStrayDialogs`): the ladder
  only lights a control inside an open dialog, so the plumbing Hand it off step sat dark under the
  proof breakdown. A dialog that holds one of the new step's targets stays (the ladder follows the
  reader into it); the restore offer and the app's confirm are never touched. It dismisses the way
  the dialog's own × does, so each modal's cleanup runs.
- **`hold: true`** on a step: done lights Next, nothing advances by itself. The proof step has it;
  it used to move on 0.9 s after the breakdown opened, before anyone could read it.
- **On a phone** (under 768 px, or a coarse pointer) the "(or press S)" asides go, a sidebar step
  says where the sidebar is and lights the ☰ until the drawer is open (the ladder now skips a
  control parked off the side of the screen, which `offsetParent` alone does not catch), and the
  card docks full-width to the far edge from its control, capped at 40% of the height with its
  buttons pinned.
- Specs: tutorial.spec.js gains the link-after-a-tour case and the phone case, and pins the proof
  hold and the lit export button.

## docs(learn): the teaching surfaces name the app's real controls; LEARN-PLAN (2026-09-21)

A docs pass plus a live walk of the plumbing and HVAC tours, ahead of the trade-guide rewrite and
the lessons ([journeys/plans/LEARN-PLAN.md](journeys/plans/LEARN-PLAN.md), the plan of record).

- **"Copy to PipeTooling" is gone from every teaching surface.** The button has read
  "Copy to /Tooling" since the hand-off grew a second destination; five guides and the plumbing
  tour's Hand it off step still used the old name.
- **Two tour steps said the wrong thing.** The plumbing step that counts Women 108 was titled
  "Count the Men's room" (now "Count the water closets"); the HVAC tour's last reading step named
  a "Legend Settings" dialog whose title is "Summary Legend".
- **The guard is a test, not a convention**: [teaching-labels.test.js](teaching-labels.test.js)
  (Node, in `npm run check`). Every `[[control]]` a tour step names must be text, a title or an
  aria-label in app/index.html, an action's own label, or a label a feature file renders (proven
  by a file + literal pointer in `RENDERED_IN_JS`); and no guide or tour may contain a label in
  `RETIRED`. Rename a control and the test names every surface still teaching the old one. It
  found the "Legend Settings" miss on its first run.
- GUIDES-PLAN.md re-stamped (all fifteen articles are published); four LEARN rows on the punch list.
## fix(sign-in): signing in no longer wipes the takeoff made signed out (2026-09-20)

Found while checking whether unsaved on-device work survives a sign-in. It did not: a plan opened
and marked signed out, then a sign-in from inside the app, ended with the page reloading itself
onto an empty canvas, the marks and the device backup gone and nothing offered back. That is the
try-it-then-sign-in path, not an edge case.

The cause was the admin force-reload. `checkGlobalForceReload` (save-engine.js) runs at sign-in
and reloads when the server's `force_reload_after` stamp is newer than the browser's own. A
browser that had never been through one has NO stamp, which read as 0, older than everything, so
the first sign-in on any browser always fired it. And `doGlobalReloadNow` cleared the device with
`indexedDB.deleteDatabase('clickcount-pdf-cache')`, the database that also holds the takeoff
backups, the one copy of work that is not in the cloud.

- **A browser with no stamp adopts the server's stamp and does not reload** (a
  `global_reload_baseline` save-status event). It loaded this shell moments ago, so there is no
  broadcast it can have missed; one made AFTER this still reloads it. The takeoff stays on
  screen through the sign-in.
- **A force reload keeps the takeoff backups.** It writes one last backup, then
  `idbClearCachesKeepTakeoffBackups` (idb.js) empties every other store exactly as before (the
  PDF cache, view PDFs, zoom rungs, icons, logs, upload-resume) and leaves `takeoff_backup` and
  its meta alone. The clear is awaited, capped at 2 s each, because a transaction still open at
  unload is aborted. After the reload the work comes back through "Project from Last Session".
- **It keeps the `clickcount-last-project` pointer too.** Signed in with unsaved marks, autosave
  can create the cloud project in the moment before the reload; without the pointer the fresh
  document would offer nothing, though the work was safe in the cloud. Reasoned from the code,
  not reproduced. Advanced's "Clear cached data and reload" is the user's own button and is
  unchanged.

signin-keeps-takeoff.spec.js (cloud-gated, against the real project's stamp): no stamp, no
reload, the plan and three marks still there, the stamp adopted; a stale stamp, the reload
happens and Keep brings the three marks back. Engine unit tests: the clear replaces
`deleteDatabase`, and a browser with no stamp takes the baseline and reloads for a later
broadcast. idb.test.js pins the selective clear. upload-then-save.spec.js's stamp seeding still
holds. Gates: the full local suite, `npm run check`.

## fix(restore): Keep uses the device's PDF when the cloud has none, and uploads it (2026-09-20)

Asked: when someone continues from a file that is on the device but not in the cloud, is the
next step, uploading it, available, and does it still auto-sync? Walked end to end on the test
account rather than read off the code.

**What already worked.** Signed in, nothing has to be clicked: the moment a plan has a mark, the
engine's autosave CREATES the cloud project ("Autosave: creating project in cloud"), syncs the
marks, checks the project out to the user, and then uploads the PDF on its own
(`uploadLocalPdfToCloudIfNeeded` on the autosave tick). Later edits autosave. Signed out, the
header's Unsaved / Save is the door, after signing in.

**What was broken.** A reload before that PDF upload lands leaves the cloud row with marks and no
`pdf_path`, and the file only in the device backup. Keep on "Project from Last Session" then
failed with "Failed to restore project: No PDF available for this project", over an empty canvas,
with the PDF sitting on the device. `doRestoreLastProject` only used the backup's PDF when the
backup's MARKS were newer than the cloud's (`useIdbBackup`), and the marks had already synced.

- **The device's PDF is used when it is the only copy** (`!proj.pdf_path`, and no hash conflict),
  whichever side has the fresher marks. The cloud's marks still win when they are newer.
- **Then it goes up by itself.** The restore hands that copy to the engine as `state.pdfBuffer`
  (it used to null it), so the autosave tick uploads it with no Save click, and the project
  keeps autosaving.
- **When the PDF is nowhere** (the reload beat the device backup's first write too), Keep hands
  the row to `App.loadCloudProjectRow`, whose "this project has annotations but no PDF" dialog
  asks for the file, lays the saved marks on it, and the engine uploads it. It used to be a
  dead-end toast. `pendingRestore` is cleared before the hand-off, so no backup write is held
  behind a hidden prompt.

restore-device-pdf.spec.js (cloud-gated, two cases, storage uploads held with `page.route` so the
cut-short upload is deterministic). Found on the way, punch row **LOAD-DEVICE-PDF**: Load
Project's no-PDF branch has the same blind spot. Gates: the new spec, restore-last-session,
esc-ladder and the load-project specs, `npm run check`.

## fix(restore): a last-session offer no longer lands on a plan opened meanwhile (2026-09-20)

Punch row **RESTORE-LATE**, closed. The "Project from Last Session" prompt is offered when boot's
sign-in resolves, and deferred (retried on every dialog close, with a 1 s poll) while a tour or a
dialog is up. Nothing checked whether the user had opened a plan in the meantime, so on a slow
connection they could upload a plan, answer Load Annotations, and have "reopen your last
project?" land on top of their Save dialog.

The rule, decided with the trade-off laid out: **drop the cloud offer, keep the on-device one.**

- A **cloud** offer (`{ cloudLast }`) is only a pointer. Once a plan is open
  (`state.pages.length > 0`) it is dropped, whether it arrives then or a deferred retry finds it
  so. Nothing is consumed: `clickcount-last-project` stays, the project is in Load Project, and
  the offer returns next boot. The drop is a `restore_prompt_dropped` save-status event.
- A **local** offer (unsaved on-device work) still shows over an open plan, as before. It is the
  only way back to that work: the open plan's own backup outranks the held record at the next
  boot (save-utils.js `pickBootRestoreCandidate`), so dropping it would lose unsaved work without
  the user ever being asked. The offer after a tour ends is unchanged for the same reason.

One check at the top of `openLastSessionRestorePrompt` (features/restore-last-session.js), which
the deferred retry also goes through. The T1-01 write hold is untouched: a dropped offer never
became `pendingRestore`. Gates: restore-last-session.spec.js (6, the new case covers the deferred
retry, the on-the-spot drop, and the local offer still showing), the full local suite,
`npm run check`.

## test(turn-in): the flag-on Turn In wait reports why it timed out (2026-09-20)

Punch row **TURNIN-FLAKE**, worked and still open. Once, in about sixteen parallel runs of the
five cloud spec files, turn-in-self-release.spec.js's flag-on Turn In never showed "Project turned
in." inside its 15 s wait, and the failure said nothing else. Six more parallel runs were green,
so it was not reproduced. What changed: that wait now fails with the save-status log since the
click, the visible toasts, the open dialogs and the banner's text, so the next occurrence names
its cause instead of timing out mute. The candidates, from reading `doTurnIn` (save-engine.js):
its refusals end in a plain toast, not the turned-in card: the pre-probe reading the connection
as offline (likelier with four workers on one account), "Sync in progress, try again in a
moment", and "Turn In is already running".

Found while stressing it (every Supabase call delayed 2.5 s, test-only): the "Project from Last
Session" prompt opened over the spec's Save Project dialog. The prompt is deferred while another
dialog is up and retried every second, but nothing checks that the user has opened a plan in the
meantime. That is a real hazard on a slow connection, in backup-sensitive code, so it is punch
row **RESTORE-LATE** rather than a drive-by fix.
## fix(film): a room drag no longer misses in a full render (2026-09-20)

Punch row **FILM-DRAG**, closed. Two of three full HVAC renders stopped at `boxRoom`'s wait for
the Room Size dialog; the quick `--chapters-only` pass never did. The cause is the app's own
gesture rule, not the script's logic: on a rect tool a press that sits still for 280 ms becomes
hold-to-aim (app.js `AIM_PRESS_MS`), and only a move past 6 px first promotes it to a drag
(`RECT_DRAG_MIN_PX`). A rendered frame costs 100 ms or more and the film's eased move starts
with sub-pixel steps, so under a render the hold fired before the drag armed and the release
placed one corner instead of closing the box.

`boxRoom` (scripts/build-hero-video.js) now nudges the real mouse 8 px right after mouse-down,
before the first frame is shot, so the drag claims the gesture at once; the drawn cursor is
`R.cur` and does not move. Frame counts are unchanged (3,086), so the committed film and its
chapters file stand. Three of three full renders ran clean with it. The gotcha in
journeys/plans/LANDING-REFRESH.md now carries the cause instead of the workaround.

## feat(intake): sheets name themselves from the title block (2026-09-20)

Punch row **SHEET-TITLE**, closed. A page's default label was the file name and a page number,
"bid-set.pdf, p24", until somebody typed a better one in Prepare PDF. The app now reads the sheet's
number and title off its own title block, the way D24 reads room names off the plan, and labels
the page "P-101 · Plumbing Plan". The label already flowed to the sidebar, the report headings,
the legend title, a line type's "on pages" list and Prepare PDF's tiles and Page Name tab, so this
is the reader plus one default.

- **The reader** is pure, sheet-title-model.js (`readSheetTitle`, unit-tested). The NUMBER is a
  whole text item shaped like a sheet number (A-101, M2.01, FP-101, E001) inside the title-block
  zone (the bottom 28% of the sheet or its right-hand 22%): the tallest wins, a SHEET / DWG NO
  caption and the bottom-right corner break ties, so a panel tag on the plan ("LP-1") or a
  referenced sheet in a keynote is not it. The TITLE is the line a TITLE caption points at, or
  one that names a kind of drawing (PLAN, ELEVATIONS, SCHEDULES…) nearest the number; the value
  under a PROJECT or CLIENT caption is never it; two or three stacked lines are joined; a shouted
  title is calmed to "First Floor Plan" (HVAC, RCP and numbers stand). No title: the number alone.
- **Conservative on purpose.** A label nobody typed must be right or absent: no text layer (a
  scan), no title block, or no sheet number reads as nothing and "file.pdf, pN" stands.
- **The intake** (features/pdf-intake.js `applySheetTitles`) reads each NEW page once, on a fresh
  upload and on Add pages, before Prepare PDF opens, so the trim grid shows the read names. It
  replaces only the intake's own default (`isDefaultPageLabel`), never a typed name or a saved
  project's label. A sheet stored sideways is tried in the other three rotations from the same
  text fetch. Sequential under a 2 s budget: thirty sheets read in about 0.3 s, and a huge set
  stops reading rather than holding the upload (the rest keep their file names).
- features/tag-reader.js publishes its pdf.js-content conversion as `App.textItemsFromContent`,
  which the intake shares; its own read is unchanged.

Both sample sheets read ("A-101 · First Floor Plan", "P-101 · Plumbing Plan"). The project is
still named for the file. The hero films type the sheet's name on camera as before; the field
now arrives already filled. Gates: sheet-title-model.test.js (11), sheet-title.spec.js (3, a
sideways sheet and the Page Name tab among them), the full local suite, `npm run check`.

## fix(landing): no hero caption sits under two seconds (2026-09-20)

Punch row **CAPTION-DWELL**, closed. A few captions in the hero films were on screen too briefly
to read, even in the scroller: "Open sheet…" (1.2 s) and the closing hand-off line (1 s) on all
three films, and four quick HVAC beats (the unit placed 0.8 s, the third and fourth diffuser
1.9 s and 0.9 s, the static-path row 1.75 s, the thermostat tick 1.1 s).

- **The opener is one line.** "Name the working sheet P-101 · Plumbing Plan, then open it." covers
  the naming and the sheet opening; the separate "Open sheet…" caption is gone.
- **The closing caption starts with the hand-off**, at the first move toward Copy to PipeTooling /
  Open in TakeoffTooling / Copy Schedule, not a second before the end. It reads for 3.7 s or more now
  and "Hide the marks…" keeps 2.4 s.
- **HVAC's quick beats hold.** Placing the unit rides the RTU-1 caption ("…then place it over the
  corridor."); the third and fourth diffuser, the static-path row and the thermostat tick each
  hold longer. The film is 128.6 s (was 124.9 s).

Shortest caption now: plumbing 2.25 s, electrical 2.38 s, HVAC 2.21 s. Plumbing and electrical
needed no render (a caption costs no frames): `--chapters-only` rewrote their chapters files
and the footage stands. HVAC was rendered, on Playwright's Chromium; two of three full renders
missed a room drag, which is written up with the workaround in LANDING-REFRESH.md's gotchas.
The landing's numbers follow from the chapters files. Gates: landing-trade.spec.js and seo.spec.js
(18 of 18, the HVAC chapters file against its mp4's length among them), landing-assets.test.js,
`npm run check`.

## chore(landing): the spotlight frames follow the films again (2026-09-20)

Punch row **SPOTLIGHT-SYNC**, closed. The electrical and HVAC films grew into a whole room and a
whole floor, and the twelve spotlight frames under them were still cut from their own small
takeoffs, so six captions quoted numbers the films no longer show ("174 lb", "600 of 2,000 CFM",
"6 rows", "2.3%").

- **The seeds are the films' layouts.** scripts/build-screenshots.js: `electricalBase` builds the
  three circuits off LP-1 (chained through `App.commitChainPoint`, each with a square home run
  flagged `homerun`, the panel a counter named LP-1); `hvacBase` seeds the six rooms, RTU-1 at
  3,000 CFM and 0.8 in. w.g., EF-1 and every device, and `hvacRun` traces the film's duct with
  real clicks (the main stepping down, five branches, the return main, the exhaust run). `PB()`
  quotes the films' plan coordinates as they stand.
- **Twelve frames re-cut** with `--set spotlight`; no film render. They read the films' numbers
  now: 13 runs and 202 ft of EMT, voltage drop 1.3% / 1.5% / 0.3% across circuits 7, 9 and 11,
  14 rows to TakeoffTooling; six rooms served, 2,400 of 3,000 CFM, 19 flex drops, 244 ft of
  straight duct at 1,082 lb. The trace frame shows the main leaving RTU-1 (880×660, so the unit
  and the hint card are both in frame).
- **Six captions in index.html** quote the new frames, and the trace frame's `width`/`height`
  follow its new pixels (landing-assets.test.js pins them).

Gotchas for the next re-cut are in journeys/plans/LANDING-REFRESH.md (SPOT-7): the legend over
the Break room, the Duct button's toggle, and why the trace frame shows one leg. Cut with the
system Chrome, since Playwright's browsers are not downloaded on this machine. Gates:
landing-trade.spec.js and seo.spec.js (18 of 18), landing-assets.test.js, `npm run check`.
## chore(punchlist): DEV-AUTH closed, the cloud specs run green (2026-09-20)

The test account signs in again: `config.local.js` carries new dev-auth credentials, and
`/app/?devAuth=1` on localhost lands signed in with a clean console. With that, the five
cloud-gated spec files ran against the cloud for the first time since the 2026-09-19 sitting:
turn-in-self-release, indexeddb-backup, load-project, load-project-delete and
load-project-empty-pdf, 10 of 10 green. That confirms **SPEC-TURNIN** (the `#preparePdfName`
fill) and **SPEC-DUPES** (`createNamedCloudProject` saves once), both landed unrun.

One fix on the way: turn-in-self-release.spec.js runs 29 to 30 s (a cloud upload, two turn-ins
and a checkout) against Playwright's default 30 s, so its first run here timed out at 30.1 s
with every step passing. It sets `test.setTimeout(120000)` now, like the other long cloud cases.

Seen once and not reproduced: in one of three parallel runs of the five files (4 workers, all
on the one test account) the flag-on Turn In never showed "Project turned in." inside the
spec's 15 s wait. Four serial runs and the other two parallel runs were green. Not diagnosed.

Run with the system Chrome (`channel: 'chrome'`), since Playwright's own browsers are not
downloaded on this machine. `config.local.js` is gitignored, so it lives in the checkout that
made it: a second worktree or the main checkout needs its own copy.

## feat(landing): the captions are a three-line scroller the page draws, in plain sentences (2026-09-20)

Will: the films' captions read too fast the way they were shown (one pill baked into the frame,
gone in a second or two), and they were estimator shorthand ("Cold in.", "Hot back.", "Rise.")
that a first-time visitor has to decode. Decided on a mock (`--no-captions` footage):

- **The scroller.** The bar under the film carries the captions as three rows: the beat on
  screen in the middle beside a gold caret, the one before it above and the one COMING below,
  both dimmed and a touch smaller; the list slides up a row at each beat and the caret nudges.
  A reader sees what is about to happen and has the whole beat, plus the row before it, to read
  it. Two lines a row on a phone. Reduced-motion readers, who keep the still, do not get it.
- **The films carry no baked caption now.** `build:hero-video` renders without the pill by
  default (`--baked-captions` restores it); every caption and its time still goes to
  `img/hero-<film>.chapters.json` as `beats`, which is what the scroller reads. So rewording a
  caption is the one-minute `--chapters-only` pass, not a render.
- **Plain sentences.** All fifty-odd captions rewritten to say what is happening and why:
  "Trace the cold water piping, from the meter out to the fixtures.", "The app adds the pipe
  hangers at the spacing the plumbing code requires.", "Chain from device to device. Each click
  adds the conduit and its 9.5 ft vertical drop.", "It checks the unit's fan can push air down
  the longest duct path." The one-second "30 sheets." and "30 sheets. Keep 3." merged into one
  sentence. "Nothing missed." became what the estimator DOES ("Hide the marks, then show them
  again, to check the sheet for anything missed."), which is also true where the old claim was
  not (the plumbing sheet's mop sink, prep sink, dishwasher, water heater and interceptor are
  still uncounted). The spec holds every caption to a sentence of at most 100 characters.
- **Chapters are marks, not caption text.** A film calls `R.chapter('Pipe')` where a chapter
  starts; the old table matched chapters to caption wording and would have broken on this
  rewrite. A film that does not mark exactly four fails the pass.

The three films re-rendered for this and for the sheet-naming beat below: plumbing 47.0 s,
electrical 79.1 s, HVAC 124.9 s.

## feat(report): the report names its project and its sheets (2026-09-20)

Will, reading the takeoff report the landing now shows: "Takeoff Report" over "Page 1:
sample-set.pdf, p24" looks unfinished, and it was the same title on every report from every
project. The title is the project's name now, "Main St Restaurant Takeoff Report" (plain
"Takeoff Report" when nobody named the project), over a date line. A sheet someone NAMED stands
as its own heading, "P-101 · Plumbing Plan"; only the intake's default label (the file name and
page number) keeps its "Page N:" prefix, since there it is the only thing saying where the sheet
sits in the set. `reportTitleFor` and `pageHeadingFor` are pure, in report.js, unit-tested. The
hero films name their working sheet on camera (Prepare PDF, the Page Name tab:
`nameWorkingSheet` in scripts/build-hero-video.js), so the report picture at the end of each
film reads properly and so does every place the app names a sheet ("P-101 · Plumbing Plan: 2
runs" in a line type's details). Punch row SHEET-TITLE: read the sheet number and title off the
title block's text layer, the way D24 reads room names, so nobody has to type it.

## feat(landing): the HVAC film takes off the whole floor (2026-09-20)

Will, on the three-room cut: incomplete, on all four counts offered (rooms left unserved, no
return or exhaust, no controls, an ending that flashed the result). Third cut, **121.9 s** (was
65.8), and the bar's question, "duct an office suite", is finally literal.

- **Every occupied room** is boxed and served: Open Office, Lobby, Office 101, Office 102,
  Conference, Break. The two offices get their numbers typed in the Room dialog, because the
  plan calls both "OFFICE" and the app would otherwise keep them as one room with two boxes.
- **One system, one main.** RTU-1 is 3,000 CFM with 0.8 in. w.g. of external static (the ESP
  arms the static-path check), its unit over the corridor's east end. One supply main starts ON
  the unit (the deck height writes its riser), runs the corridor west and turns into the Lobby,
  stepping 26x16, 22x16, 20x14, 16x14, 16x8, 12x8 past each takeoff: the app's ductulator sizes
  for the air left on each leg, typed in the S popover's Custom row. A branch taps off into
  each room; the last one traced is sized BY S, which by then reads exactly its own room's 600
  CFM. Sixteen 150 CFM diffusers, a foot off their duct, each on a flex leader.
  *Found while building it:* two trunks leaving one point do not work. A run that starts on
  another run is its branch, so two mains sharing the unit's point (and a return main ending
  there) are each other's children, the system has no root, and its designed air reads 0. The
  guard did not catch that (0 of 3,000 is "within capacity"), the audit line did.
- **The return:** two 24x24 return grilles in the corridor on a 24x14 return main to the unit's
  side, kept 17 pt off the supply main so it is not read as a branch of it.
- **Controls:** one thermostat, and the ending ticks Bid Check's "Controls / stat locations
  set", the one manual row the film has earned. Fire dampers, OA and curb power stay unticked
  and travel with the hand-off as open items, which is the honest state of this takeoff.
- **Exhaust:** EF-1, its own system (300 CFM), a 75 CFM grille in each restroom and the
  janitor's closet on a 12x6 exhaust run that starts on the fan.
- **The ending reads the result out:** the Duct Schedule by size and gauge, the fittings that
  counted themselves, the flex by the drop, the one bid weight (1,422 lb); then Bid Check row
  by row: 6 rooms served, RTU-1 2,400 of 3,000 and EF-1 225 of 300, and "Will it blow?": the
  static path, 0.21 in. of 0.80 in. over a 141 equivalent-foot critical path.

Marks draw at 44 rather than the hero 72 in this film (twenty-four devices bury the duct
otherwise). Counters named on the Create tab take their colour and M-sheet symbol off camera,
as the other films' recolours do; without it a named counter keeps the palette's default icon,
which was a water closet on an RTU. The landing speaks past 99 seconds in minutes ("Two minutes
and two seconds, from start to sent for pricing."), with the teens spelled too.

## feat(landing): the films end on what they made: the marked-up sheet and the takeoff report (2026-09-20)

Will: present the result of the work at the end, the takeoff sheet, tastefully; perhaps two
images to click. (In the app "Ledger" is the Notes ledger; the takeoff sheet is Show Report.)
When a film holds, the end card over the frame now carries two thumbnails above Play again and
the other two films: **The sheet, marked up** and **The takeoff report**. A click opens either in
the spotlight's lightbox, which zooms and pans; the arrows go between the two. Both pictures are
the film's OWN result, not a seeded look-alike: `captureResults` in scripts/build-hero-video.js
runs at the end of every film's script (on a render and on the one-minute `--chapters-only`
pass alike), turns the film's chrome, cursor and toasts off, frames the whole sheet and shoots
it (`img/hero-<film>-sheet.jpg`), then renders `buildReportHtml` for that sheet in its own page,
the way the app prints it, and shoots the whole report (`img/hero-<film>-report.jpg`: counts,
footage, hangers or derived wire, notes, and the Bid Check table). The chips swap the pair with
the film. On a phone the frame is too small to carry them, so the results and the buttons sit in
the flow between the film and the bar. The lightbox opens any `[data-lb-set]` now, and fits a
TALL image to its stage (it only bounded width, which the 4:3 spotlight frames never tested).
Pinned by landing-trade.spec.js (both files served, the lightbox opens on "The takeoff report",
2 / 2, Escape closes) and landing-assets.test.js (both files beside each film). Known rough
edge: the report titles its page "sample-set.pdf, p24"; naming the sheet P-101 is a Prepare PDF
step the films do not take.

## feat(landing): the electrical and HVAC films finish the room (2026-09-20)

Will: both bids should be more realistic. An audit of the two films against what an estimator
expects, then a rewrite of each film's middle ("complete the room": finish the bid on screen,
no warning left, about 65 to 75 s). Both scripts now END WITH A GUARD: the render reads the
app's own `getBidCheck()` and throws if any auto row warns, so a film cannot ship a warning
under a caption that says "computed".

**Electrical, third cut, 76.1 s (was 52.6).** The second cut wired 3 of 8 receptacles, left the
switch and four troffers on no circuit (Bid Check warned "10 devices on no circuit" at the
end), ran its home run as a diagonal through the janitor's wall, and never placed the panel.
Now every device in the open office is on a circuit. Devices are made on the Quick tab
(receptacle 18 in, switch 48 in, troffer, panelboard); the panel is placed at LP-1 and NAMED in
its details, which is what makes a counter the panel mark. Three circuits, each the same three
moves: a group with panel, number and load; T chains device to device, every click writing its
drop; P draws the home run square to the panel and Line Properties flags it the homerun.
Circuit 7 is the north wall's four receptacles at 6 A (4 x 180 VA), circuit 9 the south wall's
four at 6 A, circuit 11 the switch and the four troffers at 2 A (the chain keeps its anchor when
the device type changes mid-run). Three, because one cannot carry it: prototyped first against
the app, eight receptacles on one run is 145 ft at 12 A, 5.7% on #12, and the app's
voltage-drop row says so. On camera: fill 10%, voltage drop 1.4% / 1.6% / 0.3%, all devices
reached. The panel-schedule row stays neutral on purpose: it compares circuits on plan with the
panel's pole count, and one room cannot honestly match a whole panel. The bar's question reads
"wire an open office" (it was "an office suite"; the film wires one room).

**HVAC, second cut, 65.8 s (was 49.8).** The first cut boxed three rooms and served one (the
bid ended on "2 of 3 rooms under-served"), traced a 27 ft main that started at a wall with no
unit, and ran the trunk straight over its diffusers. Now RTU-1 is made as a system (2,000 CFM)
and its unit placed over the corridor's east end (a counter with no CFM in the group, named on
the Create tab: the Quick tab would prefix a size). Nine 150 CFM diffusers: four in the open
office (the "fourth turns it green" beat kept), three in the conference room, two in Office
101, each a foot off its duct so it hangs by a flex leader. The trunk starts ON the unit, so
the deck height writes its riser; S takes the ductulator's 20x14 for the system's 1,350 CFM,
and the Custom row steps it to 14x12 and 12x8 where the branches leave (the app's own sizes for
900 and 300 CFM: mid-trunk the suggestion still reads the whole system, because a branch only
takes its air once it is committed); it turns north into Office 101. Two branches start on the
trunk (the taps count themselves): Conference at 16x8 typed in the dialog, the Open Office
sized by S, which reads exactly that room's 600 CFM because it is the last air unserved. On
camera: 3 rooms served, RTU-1 1,350 of 2,000, 9 flex drops within 6 ft, 694 lb. "Fits the
roof" names the 12x8 because only duct inside a boxed room with a ceiling is judged, and the
corridor is not boxed.

Both films use the blank-sheet set. Their chapters files carry the new lengths, so the landing
reads "Seventy-six seconds" and "Sixty-six seconds" without a copy edit. The spotlight frames
keep their own smaller seeded takeoffs and the numbers their captions quote.

## fix(landing): the plumbing film counts the lavatories and the floor sinks (2026-09-20)

Punch row FILM-FIXTURES closed (Will, watching the film). Over the pull-back the plumbing film
says "Nothing missed.", and it had missed four fixtures the restaurant sheet draws: the
wall-hung lavatory in MEN 102 and in WOMEN 103, and the two floor sinks (in front of PREP, where
the prep sink drains, and by the clean table in DISH). `recordPlumbing` seeds two more counters,
Lavatory on key 5 and Floor Sink on key 6 (the sheet's own square symbol), and clicks the four on
camera after the 3-comp sinks: 21 marks, six counters. Re-rendered: 44.25 s (was 43.0). The
landing's numbers followed by themselves through `img/hero-plumbing.chapters.json` ("Forty-four
seconds, from start to sent for pricing.", Fixtures 8s, the "Plumbing, 44 s" pill), which is what
the chapters file was for. The spotlight's `plumbingBase` seeds the same two counters; five of
the six plumbing frames were re-cut (the riser frame is byte-identical) and the hand-off
caption's "5 counts" is the toast's "7 counts" now. landing-trade.spec.js's strip case reads its
seek points, its answer and its end clock from the chapters file instead of hardcoding 43
seconds, so the next re-render cannot break it. The fast `--chapters-only` pass settles longer
between frames (it flaked about one run in four at the hanger dialog). The thirty-sheet set is
realistic now too (Will): `buildSampleSet` takes the film's keep list and only those three
sheets carry the drawing; the other twenty-seven are blank drawing sheets (the banner, a border,
a title block), so Trim your set shows thirty different sheets with the trade's three standing
out instead of thirty copies of one plan. Same clicks, same 44.25 s. The electrical and HVAC
films pick this up at their next render. Not counted, and named
by the sheet's keynotes: the mop sink, the prep sink, the dishwasher, the water heater and the
grease interceptor.

## feat(landing): the hero chapters, a bar under the film (2026-09-19)

Punch row HERO-CHAPTERS closed. Under each hero film sits a two-line bar on the page's own
surface: a question in the site's serif ("How long does it take to count a restaurant?") with
the film's own clock counting beside it in real time, and four chapters as a rail, each its own
track filling in turn, each a button that seeks the film, each naming its length: Scale 7s,
Fixtures 7s, Pipe 23s, Pricing 6s (Devices and Wire on the electrical film, Rooms and Duct on
HVAC). Over the last two seconds the question resolves into the answer, "Forty-three seconds,
from start to sent for pricing.", and the clock turns green with "real time · no cuts". The
film no longer loops or hands over to the next trade: it plays once and holds on its finished
takeoff (the still beneath the video is the film's last frame, so the hold is a cross-fade to
it and never the encode's fade to black), with Play again and the other two films, lengths
included, over the held frame. The chips work as before. Reduced-motion readers keep the still
and get the four names as a static row. Decided on the real page with Will, which moved it off
the plan of record in five places (under the film rather than over it, two lines, Pricing for
Bid, the trade's own counting word, seconds per chapter); journeys/plans/LANDING-REFRESH.md
records each. "Pricing" is the honest word: the films end at the hand-off, counts sent on for
someone else to price. The times are the footage's, not copy: the film generator gains
`--chapters-only` and writes `img/hero-<film>.chapters.json` (it re-times a film in about a
minute without rendering), and the landing reads the answer's number, the chapter boundaries
and the pills' lengths from it, so a re-render cannot leave "fifty seconds" on a 52.6 s film.
No film was re-rendered for this. landing-trade.spec.js plays the films for real (seek, answer,
hold, Play again, Next takeoff, the bar's geometry, the seconds adding up, each file against
its mp4); landing-assets.test.js requires a well-formed chapters file beside each film.
Found on the way, punch row FILM-FIXTURES: the plumbing film misses two lavatories and two
floor sinks under a caption that says "Nothing missed."

## chore(punchlist): the five agent rows, worked in one sitting (2026-09-19)

**CONFIRM-ROUTE.** Delete zone and Delete room were the last two confirms with dialogs of their
own. Both are `App.confirmDialog` calls now: app.js's `openDeleteZoneForRect` builds the same
title, preview line and "Delete N marks" button and awaits the answer (it returns the promise;
`state.pendingDeleteZone`, the zone-modals.js handlers, the `App.performDeleteZone` publish and
two Esc-ladder rungs are gone), and features/room-sizer.js's Delete button asks with the room's
name and its box count, then deletes. `#deleteZoneModal` and `#roomDeleteConfirmModal` left the
shell (75 modals). Esc and Cancel keep the marks; one undo still brings a delete back. Specs
drive `#confirmOk` / `#confirmCancel` / `#confirmBody` (zone-modals, rect-drag, duct-b19b,
room-sizer); build-screenshots' `delete-area` shot clips `#confirmModal`.

**SPEC-TURNIN.** turn-in-self-release.spec.js filled `#preparePdfProjectName`, an id that never
existed; the field is `#preparePdfName`. Not run green here: the dev-auth test credentials on
this machine are rejected by Supabase (punch row DEV-AUTH), so the spec self-skips.

**SPEC-DUPES.** The cloud specs' setup saved twice: signed in, Prepare PDF's Save & open already
creates the cloud project, and the helper then ran Save Project half a second later. The save
engine picks insert or update on `state.currentProjectId`, which is null until the first insert
lands, so the second save could insert again: two rows per setup, the first under the PDF's
default name, identical on every run. `createNamedCloudProject` (cloud-test-helpers.js) names
the project in Prepare PDF, saves once, and waits on the project id and the green dot;
indexeddb-backup.spec.js uses it too. Found on the way: the helper still waited for
`#settingsAdvancedModal`, which the modal pass removed the same day, so on an empty test
account every cloud spec would have skipped with "Setup failed". It opens the Advanced
disclosure now. Same caveat as above: not run against the cloud here.

**TELEM-D7.** The day-7 `duct_run` read, recorded in journeys/plans/_INDEX-DUCT.md: 723 events
from 4 signed-in users since 2026-09-12, zero `duct_run`, zero `bend_fittings_toggle`, zero
client errors; prod's allowlist carries both events. Nothing to fix forward.

**FILM-HOMERUN.** Verified on the shipped film first: at 0:42 the caption read "The checks,
computed." over a voltage-drop row saying "Needs a circuit with a panel mark or a homerun".
The electrical film gains beat 8b: a right-click on the home run, Line Properties, the Homerun
toggle, Done (the recorder gains `rightClick()`), so the row computes on camera.
`img/hero-electrical.{mp4,png}` re-rendered.

## feat(brand): the C-reticle mark and a real tab favicon (2026-09-18)

The tab favicon was an inline data-URI yellow square with nothing on it, repeated in every
page head, and it didn't match the header logo or the home-screen icons (a yellow tile with a
thin-stroked takeoff reticle that smeared at 16px). The mark is now a C-reticle: the ring is
opened on the right so it reads as a C for CountTooling, with three ticks and a center dot,
strokes weighted for tab sizes. One source, [scripts/lib/brand-mark.js](scripts/lib/brand-mark.js),
feeds the header logo (index.html, 404.html, the guides/rules template in
[scripts/lib/site.js](scripts/lib/site.js)), the PWA + apple-touch icons, the share card
([scripts/build-og-image.js](scripts/build-og-image.js)), and the new favicon files:
`icons/favicon.svg` plus a root `favicon.ico` (16/32/48 PNG-in-ICO, written by
[scripts/build-pwa-icons.js](scripts/build-pwa-icons.js) with no new deps). Every head links
both (ICO first for Safari, SVG for the rest); sw.js precaches them; pwa.spec.js asserts the
links resolve. Regenerated: guides, rules, og-image.png, the SW stamp.

## feat(legend): the sheet legend, compact by default for electrical and HVAC (2026-09-19)

The on-plan legend can draw the way an E-sheet or M-sheet draws its own: a ruled block with
a title ("ELECTRICAL LEGEND · THIS SHEET", the custom sheet name when there is one), the
symbol in its own column, the description in caps, the column the trade reads (mount height
for devices from `mountHeightIn`, neck · CFM for air devices from `cfm` and duct-model's
neck table), the count on the right; a conduit row draws its line sample with the conductor
spec beneath and reads linear feet; a room row carries floor area in the column and volume
on the right; the footer names the panel (or the unit) with the device and LF totals.
Three styles, `legendSettings.style` (per project like the other legend knobs, a segment on
the Summary Legend dialog): `compact`, the standard for electrical and HVAC projects (one
title line, no column header, a spec line only where no column carries the fact, a footer
only when it names a panel or a unit); `full` (the column header, every spec line, the
totals footer); `tally`, the original icon · name · [count] list, still the default for
plumbing, whose icons are pictures rather than symbols. Resolution is the setting, else the
trade (`App.resolveLegendStyle`). Two things reach the tally too: the legend follows the
sheet size (canvas-draw `legendSheetFactor`: an ANSI B sheet draws at 1×, a D sheet at
about 2×, capped at 3×, so a plot reduced to B still reads; letter test pages and the
sample sheets are unchanged at 1×), and the PDF export path draws the block in ink with a
thin colour tab per row (`drawLegend(..., { ink: true })`), so it survives a monochrome
plot. The hit test and the resize grip are unchanged. canvas-draw.test.js pins the
resolution, the sheet factor, the compact and full texts and the byte-identical tally;
[legend-sheet.spec.js](legend-sheet.spec.js) drives the app.

## style(modals): the review's last fifteen asks (2026-09-19)

The Modal Review's per-dialog suggestions that the polish pass left short. Copy and counts:
Delete zone names the mark count in its title and button (`countCanvasMarks`, published on
`App`, is the one counter the confirms share), Delete room names the room and says its boxes
go while the marks inside stay, Clear page says how many marks it removes and puts the number
on the button, Load annotations says how many cloud projects match the PDF, Edit layer shows
a facts line (marks, sheet, layer). Controls: the zone dialogs' label position is a segment
that mirrors its select (`.select-segment[data-for]`, built by app.js from the options and
written back on click, so the features keep reading the select), Line Properties attaches
its ±1 / ±10 steppers to the drop field with Clear as a small link, New polyline shows the
chosen type's swatch above the override presets, the bid board's estimator filter has a
label, Load project's search sits under the title, the admin lists have empty states.
Project Settings: Advanced is a disclosure inside the footer (the same five buttons, the
same ids; `#settingsAdvancedModal` is gone, 77 modals), Edit session expired lost its Cancel
(the × is the way out). Two asks stayed deliberately: Room Size keeps its room list (six
specs and the HVAC tour drive `.room-picker-item`), and the activity overview already had a
stat-tile row.

## style(modals): the polish pass, seven primitives and fifty-two dialogs (2026-09-18)

The Modal Review (the old-versus-new page built off the Modal Gallery contact sheet) found
that most of the 78 dialogs shared seven problems, so this pass fixes the primitives in
styles.css once and then touches the dialogs the review marked Tune or Rework. The
primitives: (1) `input[type=range]` is the app's own slider, an accent track and thumb
with the fill driven by a `--fill` custom property that app.js syncs on `showModal` and on
input, and the value pinned to the label's right edge (`label.range-label` / `.range-val`);
(2) `input[type=color]` is a 38px swatch beside a hex read-out (`.color-field` /
`.color-hex`, synced the same way); (3) action buttons carry a ROLE class (`ghost`,
`primary`, `danger`, `danger-ghost`, `link`) and a middle button is ghost by default, so a
Delete on the left or a third button never falls through to a white default (Room Size,
Edit Room, Add Group, Unsaved Changes, Edit session expired, Project turned in, Prepare
PDF); (4) every dismissible dialog has a × (`data-modal-close`; app.js dismisses it by
dispatching Escape so the ladder's per-modal cleanup runs, then hides the overlay if no
rung took it) and a title-block + `.modal-card-sub` for the dialogs that carried a link in
the title row; (5) the confirms read as one template: a question title, a `.modal-lead`
consequence line, a verb on the danger button (Delete sheet, Clear page, Delete user with
`.choice-cards`), and the warnings that were accent-coloured body text are `.modal-callout`s;
(6) `.setting-row` / `.setting-label` for label-left control-right rows (the wrapping
"Show only counters used", "Snap counters to grid", "Verbose mode"), `.section-rule` for
the uppercase group headings, `.form-grid-2/3` and `.field-unit` (the unit inside the
field: the Duct Schedule knobs no longer truncate "0.08"), `.radio-seg` for the Straight /
Curved radios, and a styled `select` chevron; (7) `.empty-state` for the cloud lists and the
palette pickers. The reworks: Set Scale's 22 full-width preset rows are two chip grids under
Architectural / Engineering rules (features/scale.js); the Counter details modal folds the
icon grids and the air fields into `<details class="modal-section">` disclosures; Project
Settings keeps one primary (Save, in a footer `.actions`), moves Add pages / Download PDF
into a Sheets row and Close project into the footer links; Line Type Settings pairs its
sliders under Drops / Lengths rules; Edit session expired reads as two actions plus a quiet
discard link. Import canvas and Counters-from-schedule lost their redundant Cancel (the ×
stays); My Standards' primary moved from the header to the footer; Assign to group's
"+ Add group" is the last chip. Ids are unchanged throughout, so the specs and the tours
drive the same controls. Verified across all 78 in the Modal Gallery.

## feat(dev): the Modal Gallery, every modal on one page (2026-09-18)

A developer view for styling passes. `/app/?gallery=1` reparents every `.modal-overlay` in the
shell (78 on this date) into a grid, overriding only the overlay's fixed positioning and the card's
width under `body.modal-gallery`, so the markup, the handlers and styles.css are the app's own:
edit the stylesheet, Reload CSS, and all of them update together. Toasts and the fixed popovers
get sections of their own. Per tile: `app/index.html:<line>` and the owning feature file (found
by fetching the shell and the loaded feature files), Populate through the registered opener
(variants get a button each), Open live on the real backdrop with the app's Esc ladder closing
it. Load sample opens the sample plan through the intake and lays build-screenshots' takeoff plus a room and a group;
Mobile embeds the `&narrow=1` page in a 375px iframe because the media queries key off the
viewport. The file is injected by the boot only on the param, never a shell script tag, never
precached. Phase 2: `npm run build:modal-gallery` shoots one PNG per tile at both widths into a
contact sheet, with `--baseline <dir>` for a before/after. The spec doubles as the assertion
that every overlay in the shell renders with a real height.

## fix(edit): undo while editing a run no longer loses the run (2026-09-18)

Found by the BEND-OVERRIDE test round. A run in Edit Polyline is spliced out of its page into
`state.editingPolyline`, so every undo snapshot taken mid-edit (a vertex delete, a fitting
choice, and Done Editing's own) captured the page WITHOUT the run; an undo then dropped the run
outright and left the tool in edit mode with nothing to edit (Done Editing still showing).
Predates the menu (the old right-click delete took the same snapshot) but the menu made it easy
to reach. Now app.js's snapshot wrappers put the run home for the length of the copy, undo and
redo do the same for the snapshot they take for the opposite stack, and an undo or redo applied
mid-edit leaves edit mode cleanly (tool, Done Editing button, canvas cursor class, the vertex
menu). Done Editing homes the run as it was when editing BEGAN, so one undo after Done reverts the
whole edit session, drags included (drags take no snapshot of their own). Regression: the fifth
case in bend-fittings.spec.js, which also covers the menu's Delete vertex, a closed run, outside
click dismissal, screen-edge placement, the touch long-press, and a save/import round trip of the
override.

## feat(lines): the edit-mode vertex menu for fittings from bends (2026-09-18)

Punch row BEND-OVERRIDE, the follow-up to BEND-FITTINGS below. In Edit Polyline, a right-click on
a vertex of a run whose line type counts fittings from bends now opens a small menu instead of
deleting the vertex: the heading says what the angle reads ("Vertex 2 · reads as 90°", and the
override once one is set), then "No fitting here" (a jog drawn to route around text),
"Count as 45", "Count as 90", "Read from the angle" (only while an override is set), and
"Delete vertex" (the old action, kept reachable). An endpoint of an open run is never an elbow,
so it offers Delete vertex only. The choice writes `points[i].fitting` on the vertex, which the
model already honoured, so it rides save, load, export and the Artboard untouched; each edit is
one undo step. A run whose type has the option off keeps the old right-click-deletes behaviour
exactly. The bend chips now paint on the run being edited too (they were only on committed runs),
through a helper shared with the draw core, and an overridden "no fitting" vertex shows a grey
dashed "no" chip so the choice stays visible. The status bar's edit hint names the right-click.
New: `features/bend-override.js` (the menu, the tool-context-menu dismissal pattern),
`drawBendFittingChips` in canvas-draw.js; a fourth case in bend-fittings.spec.js. Tees and wyes
still wait for the water plan's attachment rung.

## feat(landing): SPOT-6, the spotlight lightbox (2026-09-18)

Robert's ask: a click on a spotlight frame should make it bigger, so a visitor can read the Bid
Check rows and the schedule and zoom in and out. Every frame is now a button that opens a
`<dialog>` lightbox with the frame at full size (the JPEGs are rendered at 2×, so they hold the
detail), its value title and description under it, and the trade's other five a key or a tap away
(arrows, ← →). Wheel, pinch, + / − and double-click zoom to 5×, drag pans; Escape, the Close
button or a click on the backdrop returns focus to the frame that opened it. No library; the
hero's inline-script idiom. `landing-trade.spec.js` opens a frame, walks to the next, zooms and
closes. Plan: journeys/plans/LANDING-REFRESH.md, SPOT-6.

## feat(lines): fittings from bends, a line type option that counts its own elbows (2026-09-18)

Punch row BEND-FITTINGS (Robert's ask; mockup https://claude.ai/artifact/6Gj27nuq1uYh9BZjeSPm82).
A line type's details gain "Fittings from bends": a toggle, off by default, and one row per bend
class naming the fitting it produces and how many (bend nearer 45°, bend nearer 90°, drop at an
end; defaults from the type's name, so "2in Cu" earns "2in Cu 45° elbow" and "2in Cu 90° elbow").
With it on, every run of the type derives its elbows from its own geometry: each interior vertex
of a polyline by its direction change (the duct tool's angle function, nearer of 45 and 90:
22.5° / 67.5°; a smaller wobble counts nothing) and each drop at a run's end as a 90 (the Chain
tool's device verticals included). The rows are child counts (per bend / per drop, tagged
derived) so they ride the Summary, Show Report, Copy Summary and Copy to PipeTooling exactly as
the hangers do, and never become marks; a small "45" / "90" chip at each bend shows what the
tally will say, live and in the exported markup. Bid Check gains "Fittings counted on every pipe
run" beside the hangers row: informational while the option is off everywhere, a warning once
some pipe types count and others do not. Telemetry: `bend_fittings_toggle` { on, lineType } on every toggle, allowlisted by
`supabase/migrations/20260918053207_log_user_event_bend_fittings.sql` (applied to prod through the
Supabase MCP 2026-09-18 from the deployed body; the drift test pins it). New: `fitting-model.js` (pure, node-tested),
`bend-fittings.spec.js`; the model honours a per-vertex `fitting` override whose edit-mode menu
is punch row BEND-OVERRIDE. Tees wait for the water plan's attachment rung.

## feat(landing): SPOT-5, tighter spotlight frames and value captions (2026-09-18)

Robert's review of the first spotlight cut: the eighteen frames were a fixed 1200×900 window with
the surface small in the middle, and the captions described rather than sold. The generator's
`frame` became a per-frame `crop` (a 4:3 window sized to the surface and aligned to an anchor
element, with an optional per-shot `css`, the Bid Check and Summary frames on a 420 px sidebar),
the riser camera tightened to the meter corner, the electrical handoff hides the sheet legend
behind the toasts. Each figure's caption is now a value title plus a one-line description that
quotes the numbers in the frame; the ledes say "six things the app does for…". Every `<img>`
carries its JPEG's real width/height and `landing-assets.test.js` pins that. Plan:
journeys/plans/LANDING-REFRESH.md, SPOT-5.

## feat(landing): SPOT-4, the trade spotlight under the hero (2026-09-18)

Punch row SPOTLIGHT closed. A section right after the hero, "Your trade, in the app", shows six
frames of the real app for the trade the chips have selected: three `.spotlight-set` blocks shown
through `html[data-hero-trade]` (the switch the film and the proof panel already follow), each
with a heading, a lede naming the sheet, and six lazy 4:3 JPEG frames with one-line captions; a
3 × 2 grid on desktop, a snap strip under 900 px; no new JavaScript, and a hidden set's frames
are never fetched. The eighteen frames come from `scripts/build-screenshots.js --set spotlight`
(SPOT-1 to SPOT-3). `landing-assets.test.js` joins `npm run check` as the drift guard;
`landing-trade.spec.js` pins the visible set, the lazy loading, the chip swap and `?trade=hvac`.
The three ⚑ decisions were built with their recommended defaults (six frames, plain headings,
quiet captions) and remain Robert's to change. Detail in LANDING-REFRESH.md.

## feat(landing): SPOT-3, the six plumbing spotlight frames (2026-09-18)

Punch row SPOTLIGHT, third rung. `scripts/build-screenshots.js` takes a per-shot `plan` (the
restaurant sheet for plumbing), `dropSizes` and `clipboard` flags; `plumbingBase` seeds what
"Kitchen, Tuesday" makes on camera (the four counters, `2in Cu cold` and `1-1/4in Cu hot` with
their rulebook hangers, the four traced runs, the 3 ft riser at the meter). Frames: the Quick tab,
the "From the rulebook" hanger offer, the riser, the scale check at 0.1%, Bid Check's hangers row,
the copy toast. All eighteen frames now exist; SPOT-4 ships the section.

## feat(landing): SPOT-2, the six electrical spotlight frames (2026-09-18)

Punch row SPOTLIGHT, second rung. `electricalBase` in `scripts/build-screenshots.js` seeds what
the "Circuit 7" film makes on camera and `--set spotlight` writes `img/spotlight/electrical-{1..6}-*.jpg`:
the Quick tab on the Electrical profile, the Chain panel over the chained run with its drops, the
conduit's raceway and conductors, the derived #12 THHN rows, Bid Check with conduit fill and
voltage drop computed (the home run is flagged as the homerun, which a circuit needs to know where
its panel is), and the TakeoffTooling hand-off toast. No landing change yet.

## feat(landing): SPOT-1, the spotlight screenshot set and the six HVAC frames (2026-09-18)

Punch row SPOTLIGHT, first rung. `scripts/build-screenshots.js` gains `--set spotlight`: a second
catalogue written to `img/spotlight/` as JPEG (quality 85) in a fixed 1200×900 window centred on the
surface, so a trade's six frames share one aspect on the page; `frameRegion` frames a sheet region
like the hero film's camera. The HVAC set is built: the Quick tab with a 150 CFM diffuser, Room Size
naming CONFERENCE 103 off the plan, the traced main with its chip and hint card, the S popover, the
Duct Schedule at 174 lb, Bid Check's HVAC rows. No landing change yet (SPOT-4 ships the section once
all three sets exist). Detail in LANDING-REFRESH.md.

## feat(landing): the landing for a shop owner: ?trade= link, a proof panel that follows the trade, the shop section (2026-09-18)

Five changes for one visit (Robert: an HVAC shop owner in Houston and Dallas landing on the page).
`/?trade=hvac` lands on the HVAC film, pinned (plumbing and electrical likewise; unknown values
fall back to plumbing, unpinned). The Bid Check proof panel follows the selected chip through
`html[data-hero-trade]` with three row sets; HVAC's are the rows the app computes (every room
served, systems within capacity, bid weight with its gauge citation). A new section before the
testimonials, "For the shop, not the seat": the All Bids board from the Overseer guide, read-only
enforced on the server, and four rules a shop runs on. The HVAC card names plan-and-spec and
design-build and says the gauge is a simplified SMACNA schedule cited by rule. "Austin, Texas" in
the footer. No HVAC testimonial invented. Pinned by `landing-trade.spec.js`. Detail in
LANDING-REFRESH.md.

## fix(landing): the trade chips sit directly above the film they select (2026-09-18)

Robert, from the live page: the chips read as a headline ornament above the h1 while the film they
control sat a screen below. They now sit under the CTAs and the phone line, directly above the hero
media (44 px above it, 16 px gap). Same buttons, same behaviour, same spec.

## fix(duct): the suggestion sentence is a card above the footer, not a label on the cursor (2026-09-18)

Punch row DUCT-HINT (Robert, from the HVAC hero film). The Duct tool's one-line suggestion
("600 CFM downstream · suggests 12"Ø or 16×8 @ 0.08″/100′. S accepts") was painted centred under
the cursor size chip; the offsets put its middle on the cursor's own row, so it ran both ways
across the cursor and along the line being traced, over the diffusers being aimed at, and at hero
scale it was 1.5× larger still. It now rides `#ductHintCard`, a toast-look card fixed above the
footer inside `.canvas-wrapper` (screen pixels, so the same size at any zoom; pointer-events off,
so never a click target; the leading CFM bold, the S a keycap), filled and toggled by
`syncDuctHintCard` from the overlay draw and hidden with the draft. Only the "24×12 ▾" chip stays
at the cursor as the tap target it already was. Pinned by a DUCT-HINT case in duct-suggest.spec.js.
The HVAC hero film is re-rendered; its two trace-beat captions ride the top of the canvas so the
card stays clear. `npm run build:sw` re-stamped the shell.

## feat(landing): the trade chips select the hero film; the three-trade take retires (2026-09-17)

Punch row HERO-EHVAC closed. The three chips above the headline are buttons now: the pressed
chip is the film selected, the lit one the film playing, a click swaps the film and its poster in
place (the `<source>`, the `poster`, the SEO still and its alt), and with no click the three
films play in turn (the plumbing film first; `ended` selects the next; a click pins a trade and it
loops). Reduced-motion readers keep the stills, which the chips still switch. Playback still
starts when the hero scrolls into view. `img/landing-hero.{mp4,png}` are deleted and the
generator loses `--film trades`, its seeds, its `record()` and `loadApp` (the act-time sync
`index.html` hardcoded is gone with them); `img.hero-shot` is plumbing's poster now. AGENTS.md,
DECOMPOSITION_MAP.md and the build-screenshots comment follow.

## feat(landing): the HVAC film, "Pounds, not feet", first cut (2026-09-17)

`npm run build:hero-video -- --film hvac` writes `img/hero-hvac.{mp4,png}` (49.8 s, 3.4 MB) from
the office sheet, on camera: the set lands and Prepare keeps three; the scale proved; `V` and three
Room Sizer drags, each dialog naming its room off the plan (ceiling, deck, type); a 150 CFM
diffuser made on the Quick tab, three leaving the open office short and the fourth turning its tag
green; the system RTU-1 at 2,000 CFM made under Groups; `U` and the main traced at 24×12 with `S`
stepping it to 16×8 and 12×8 on the rectangular suggestions; the Duct Schedule's bid weight; Bid
Check read honestly (two rooms still short; "Fits the roof" computes itself once the deck is
known); the pull-back; Copy Schedule with its toast pinned. Generator: `recordHvac`,
`seedOfficeHvac`, the room and main geometry. Not on the landing yet; the three films now exist,
so HERO-EHVAC is the chip switching and the retirement of the three-trade take.

## feat(landing): the electrical film, "Circuit 7", first cut (2026-09-17)

`npm run build:hero-video -- --film electrical` writes `img/hero-electrical.{mp4,png}` (49.9 s,
3.3 MB) from the office sheet A-101, everything on camera: the set lands and Prepare keeps three;
the scale proved on the 24'-0" bay; receptacles, the switch and the troffers made on the Quick
tab (Category / Variant, the mount height arriving with them) and counted; the conduit type made
with + Add and given its raceway (EMT, 3/4") and conductors (3 #12 THHN + 1 #12 G) in the details
dialog; the circuit group LP-1/7 made under Groups; `T` and the Chain panel, three clicks each
writing a 9.5 ft drop; `L` for the home run to LP-1; Bid Check's voltage-drop and fill rows and
the derived #12 THHN rows; the pull-back on the plan; Open in TakeoffTooling with its toast
pinned. Generator: `buildSampleSet` takes the source sheet and the unstamped sheet id;
`recordElectrical`, `seedOffice`, the A-101 geometry and cameras. Not on the landing yet.
Detail in LANDING-REFRESH.md; punch row HERO-EHVAC now reads HVAC + the chip switching.

## feat(landing): the plumbing film makes its line types on camera, third cut (2026-09-17)

Robert's ask: the film should show the estimator making the water lines, not find them made.
Nothing about the water is seeded now. "+ Add" under Line Types, the name typed in at twelve
characters a second (`2in Cu cold`, then `1-1/4in Cu hot`), the swatch, Create; a `P` keycap
arms Polyline with the new type, the sheet's own runs are traced, `Enter` commits each; the
row's pencil opens the details dialog where "From the rulebook" already names the hanger rule
from the type's name, and one tap on Add is the row nobody typed, twice, at two spacings.
43.0 s, 3.8 MB. Film-only chrome (no app change): the bid switcher hidden, a 300 px sidebar so
names do not wrap, the scale reference line off, and a pull-back camera that leaves a band
under the sheet for the caption and the Copied card. `Recorder.type` and `Recorder.keyAs`
added to the generator. Still not on the landing; HERO-EHVAC wires the chips. Detail in
LANDING-REFRESH.md.

## feat(landing): the plumbing film, second cut (2026-09-17)

Punch rows HERO-PIPES and HERO-TRIM, one render pass. The film now traces the restaurant
sheet's own domestic water, the cold service and trunk on `2in Cu` (blue) and the hot supply
leg and trunk with its recirc return on `1-1/4in HW Cu` (red), so the legend gains a second
row and the hangers row appears twice (120 in and 72 in, IPC 308.5). 29.5 s, 3.0 MB; the
Prepare beat, the scale dialog and the count were trimmed to pay for the hot beat. Two
first-cut bugs fixed in `scripts/build-hero-video.js`: `bigMarks()` set a `lineWidth` key the
canvas never reads (the stroke is `lineTypeSettings.lineSize`, now 7), so the runs had drawn
as 2 px hairlines; and the film's overlay hides `#toastRegion`, so the Copied confirmation had
never been in frame. The copy beat lets that one card back in at the canvas's bottom left,
parks its 1.5 s self-hide, and holds it 1.3 s before "Done.". Still not on the landing page;
HERO-EHVAC wires the trade chips to the films. Detail in LANDING-REFRESH.md.
## fix(sample-plan): the 67'-4" overall measures exact (2026-09-17)

The D26 re-walk found the design-build sample sheet's overall dimension drawn 810 plan px,
which is 67'-6" at 12 px/ft, because the first bay spanned 290 px where 24'-0" is 288; the
tour's Verify Scale on that string read "Within 0.3%". The left exterior wall `L` in
`candidateAPlan()` moved from 130 to 132, so the three bays are 288 / 220 / 300 px and the
overall 808 px = 67'-4". One constant; the grid, the right wall and every room to the right
are untouched, the scale bar follows `L`. `samples/sample-plan.pdf` regenerated. The seven
specs that read the sheet's geometry pass unchanged (20 tests); guide screenshots left as
they are, two pixels is below their resolution. Punch row SAMPLE-A stays open for the
trade-eye polish (corridor label, door swings, fixture counts).
## chore(punchlist): close four rows that were already done (2026-09-17)

A read of every open row against the ledgers found three that had shipped before the
list was seeded on 2026-09-15: **J6-G** (multiply zones multiply duct) and **J5-B** (Duct and
Polyline drafts are mutually exclusive) landed in D17 on 2026-09-13 (entries below; re-driven
live in the 2026-09-14 dossier re-walks), and **J19-RERANK** had nothing left to rank, the
duct dossier's 2026-09-14 verification reading "all fifteen rows are shipped" (1 to 3 by D17,
4 to 6 by D19; the one papercut that walk filed, the arm-time callout prefill, merged as
d4802f9 on 2026-09-14). **X6-SLOT** closed by filling the empty `[decision]` in
`_STAGE6.md` with the 2026-09-13 call and its 2026-09-14 amendment. Rows deleted per the
list's own rule; no app change.

## feat(landing): the three-trade landing page, direction A (2026-09-16)

**Addendum, the hero video (same day, same branch):** the hero screenshot became a 24 s
muted looping video of the real app doing a plumbing, an electrical and an HVAC takeoff
on the sample plan, one take, each trade on its own layer, captions in frame, the trade
chips syncing to the act. Generated, not screen-recorded: `npm run build:hero-video`
(`scripts/build-hero-video.js`) walks a frame-stepped timeline with a real mouse and a
drawn cursor, screenshots the app at 2x, and encodes `img/landing-hero.{mp4,png}`
with ffmpeg (about 1 MB of H.264; the PNG is the poster, the last frame). The
`<video>` fades in over the `img.hero-shot` still once playing, starts when it scrolls
into view, pauses when it leaves, and stays hidden under `prefers-reduced-motion`.
`build:screenshots` dropped its `landing-hero` shot. Detail in the plan file.

**Addendum, the plumbing film (2026-09-17):** the generator gained `--film plumbing`
(now the default), a 33 s per-trade film on the restaurant sheet: a thirty-sheet set
built with pdf-lib and trimmed in Prepare PDF, the scale proved in the check dialog, Quick
Count with the number row and drawn keycaps, the cold-water main traced, the riser and the
hangers row, an RFI flag, the pull-back with marks hidden and shown, Copy to PipeTooling.
Marks at counter size 72 with a 170 percent ring so they read at hero size. Written to
`img/hero-plumbing.{mp4,png}`; the landing still plays the three-trade take until the
electrical and HVAC films and the chip switching land. Plan file: "The per-trade films".

PUNCHLIST.md row LANDING-REFRESH, closed. The plan of record and the build notes are
[journeys/plans/LANDING-REFRESH.md](journeys/plans/LANDING-REFRESH.md); in one line: `index.html`
now leads with the three trade chips and "Plumbing, electrical, and HVAC takeoffs, right on the
plan.", adds a card per trade (four shipped claims each, a `?tour=` walkthrough link and the trade
guide), a "numbers you can defend" pair (the scale-check screenshot beside an illustrative Bid Check
panel with three cited rows and a rulebook link), rewrites the six feature cards, folds the
browser-not-desktop promises and the pricing hand-off into one band, tags the testimonials by trade,
and puts "What trades is it for?" first in the FAQ. Header nav gains Plumbing / Electrical / HVAC on
the landing only. Metas and both JSON-LD blocks say the three trades. Decisions taken at the review
("build it", 2026-09-16): the new headline, the Bid Check panel as drawn, direction A; plus two copy
tweaks recorded in the plan.

## chore(telemetry): R2, the log_user_event allowlist catch-up, applied (2026-09-16)

Found 2026-09-15 while running R1's spec: thirteen event types the client sends (`project_close`, `tour_step`, `trade_set`, `codes_set`, `ceiling_set`, `drop_set`, `bid_check_row_state`, `child_count_from_rule`, `rule_open`, `tag_suggestion_accepted`, `ghost_placed`, `ghost_stamped`, `restore_prompt_deferred`) are rejected by the deployed `public.log_user_event` with "invalid event type", so `user_activity` never saw a tour, a trade choice, a Bid Check tick or a Close project, and every signed-in Close logged a console 400. Two more, `client_error` and `client_unhandled_rejection` (app.js `reportClientError`'s server mirror), were in no migration either.

- **The migration** `supabase/migrations/20260916143700_log_user_event_allowlist_catchup.sql` re-creates the function from the chain-latest body (`20260913025935`, duct_run) with the fifteen added and the grant / revokes re-asserted. **Not applied**: Will's go, and the applier diffs the list against `pg_get_functiondef` on prod first (this session could not; no Supabase MCP, CLI unlinked).
- **The drift test** [log-user-event-allowlist.test.js](log-user-event-allowlist.test.js): every `logUserEvent('…')` / `reportClientError('…')` literal in the client must be in the newest allowlist migration; each re-creation in the chain must carry every earlier type (the _INDEX.md conflict-note-6 rule, now pinned); the one non-literal call is asserted to be the only one. Runs under `npm run test:unit`, so `npm run check` fails the moment a new event ships without its migration.
- Docs: SUPABASE_SETUP.md migration paragraph, ARCHITECTURE Files row, AGENTS test list, _TODO.md R2 status; punch row R2 closed.

---

## feat(bids): the header bid switcher (2026-09-16, PR #100)

PUNCHLIST.md row BID-SWITCH, closed: `claude/bid-switcher` landed as PR #100 (squash edcea00), live on counttooling.com the same hour (`CACHE_VERSION 2dd90a5d4738` verified). The plan of record and the full write-up are [journeys/plans/BID-SWITCHER.md](journeys/plans/BID-SWITCHER.md); in one line: the Export control stops impersonating Upload PDF when nothing is open, a header chip names the bid you are in and opens a menu of recent ones (`recent-bids.js`, per device), and clicking a recent opens it through the same save gate as Load Project. Known limit written down there: no chip between 769 and 1099 px.

## chore(repo): the branch sweep (2026-09-16)

PUNCHLIST.md row BRANCH-SWEEP, closed. Every merged `claude/*` topic branch is gone from origin and from this Mac, and the two worktrees that sat on merged branches are removed.

- **Remote:** `claude/boot-skew-recovery` (landed as 359fdb6 + a5f1f06), `claude/settings-modal-small-viewports` (landed as 883951a), and `claude/journey-batch-final` (the 2026-08-20 batch; every JOURNEY-MAP row it carried is marked merged 2026-08-30, so the handoff's "keep until reviewed" condition was met). `origin/claude/bid-switcher` (PR #100) is the only topic branch left on origin.
- **Local:** `claude/app-review-docs-7feac0` (PR #88), `claude/ecosystem-app-review-dfd122` (PRs #84, #87), `claude/nifty-curie-67f201` (PR #98) and `claude/punchlist` (merged 04e02dd) deleted; worktrees `musing-wu-4d8868` and `app-review-docs-4e5b52` removed, both clean.
- **Also found on the way:** the punch list merge (04e02dd) had been committed to local main and never pushed; pushed 2026-09-16.

## fix(save-engine): our own Turn In is not a force turn-in (2026-09-15)

Field report through Robert: wendi, "count tooling keeps kicking me to view only after
i check things out", with a screenshot of the force-turn-in notice ("An admin turned this
project in while you had it checked out. You're now viewing only."). Nobody had: the only
admin was idle, the project unshared, one live session. The Supabase edge logs showed her
own browser calling `check_in_project` through the Turn In path three seconds after each
`check_out_project`; reproduced on prod-identical code with the test account: a plain
click on `[Turn In]` logged `turn_in_ok` then `force_turn_in` twice and opened the notice
in the very tab that released the lock.

- **Root cause.** `doTurnIn` never clears `state.checkedOutBy`; the caller learns the
  release from `refreshProjectPermissions`, which ALSO runs from the realtime row UPDATE.
  Both refreshes saw "was the lock holder, now viewer, lock not stale", the exact shape the
  2026-09-01 classifier reserves for an external force ("only an admin can clear a live
  lock" — false: the holder can, and so can any session signed in as the same user, since
  the RPC is per user). Before the 2026-08-31 notice modal this misclassification was a
  redundant toast, so nobody noticed.
- **The self-release stamp.** `noteSelfRelease(atMs, projectId)` in the engine, stamped by
  `doTurnIn` on success (and on the already-released short-circuit) and by app.js's
  `checkInCurrentProjectIfHeld` (close / load another / sign-out) on `ok`. A demotion seen
  at `refreshProjectPermissions` while a Turn In is in progress or within
  `SELF_RELEASE_GRACE_MS` (15 s, constants.js) **of a release of that same project** is
  ours: `self_release_refresh` in the Save Status log, no notice, no toast, no flush over
  the released lock (`self_release_flush_skipped`). Outside the window the classifier is
  unchanged. The stamp records the project it released (defaulting to whatever is current
  at stamp time, which is the released one on every path) so the window cannot leak across
  projects: release A, check out B, and a genuine force on B inside the 15 s still raises
  the notice. Pinned by a node test that is red without the scope.
- **Copy.** Behind the same flag the notice stops asserting an admin: "This project was
  turned in while you had it checked out, by an admin or by another tab or device signed in
  as you." (features/turn-in.js swaps `#forceTurnInNoticeBody`; R1-FLIP moves it into the
  markup.)
- **Ships DORMANT (2026-09-15, Robert's call: a tester walks it on the real site before it
  goes live).** The classification and the copy run only when the device has opened
  `/app/?ff=self-release` once — the new **feature flags** seam in app.js
  (`featureFlagEnabled(name)`, localStorage `clickcount-ff-<name>`, `?ff=-<name>` forgets,
  a device preference that survives sign-out; the engine reads it through
  `ctx.isSelfReleaseStampEnabled()`). With the flag off, `refreshProjectPermissions`
  classifies byte-for-byte as before, pinned by a fifth node test. The tester's checklist
  is _TODO.md R1-TEST; making it live for everyone is R1-FLIP.
- **Why the banner mattered.** `[Check out to Edit]` becomes `[Turn In]` in the same spot
  the instant checkout succeeds, so a re-click releases the lock; that is the loop she was
  in. Left as is (a product call, see _TODO.md R1); the fix stops the false accusation and
  the double surfacing, not the re-click.

Tests: five save-engine.test.js cases (own doTurnIn → not a force; the app-side stamp; the
window closing → still a force; no flush over a self-released lock — all red on the old
engine — and flag OFF → the old classification, the dormant pin), and
turn-in-self-release.spec.js (cloud-gated, one project, both halves: flag off → the notice
still fires with the shipped copy; flag on → turned-in toast, no notice, `[Check out to
Edit]` works again; red on the old engine at the notice assertion). Verified pre-fix that the load-another-project path did NOT show
the notice (state resets before the UPDATE lands), so the spec pins the Turn In button.

Side findings recorded in _TODO.md, not fixed here: 13 client event types
(`project_close`, `tour_step`, `trade_set`, `bid_check_row_state`, …) are missing from
the deployed `log_user_event` allowlist and 400 on every call (needs a migration); the
2026-09-01 field report in admin-onboards-a-team.md was very likely the same estimator
and the same button.

---

## Project Settings: the layout pass, direction A (2026-09-15)

Reported with a screenshot of a real bid: the settings card had grown into a stack of
same-weight buttons, a bell floating alone in an empty row, a two-line title carrying the
project name, and two-sentence hints squeezed beside their controls until "Ceiling
height" read one word per line. Three directions were mocked (same-shape tidy, tabs,
collapsed summary rows); the tidy one shipped.

- **Header**: the title stays "Project Settings"; the project name is a subtitle line
  (`#settingsSubtitle`, ellipsised) under it.
- **Status strip**: `#settingsCheckoutSection` is one line, a dot (`#settingsCheckoutDot`,
  green yours / yellow someone else's / grey available), the checkout state in one short
  sentence (`Checked out by you · saved 9:46 PM`), and the Save Status bell at the right;
  hidden with no cloud project, so the bell never sits in an empty row.
- **Actions**: Save to Cloud is the one primary (centred, full width); Share, Turn in,
  Check out, Force turn-in, Add pages, Download PDF and Close sit in an auto-fit grid of
  same-weight secondaries (`.settings-action-grid`; hidden ones leave no hole).
- **Bid review** is a single line (`Bid review · not started` + the link-styled
  transition button). Pre-existing bug fixed on the way: `updateUI`'s `.supabase-only`
  reset resurrected the row signed-out (blank status, live button); it now stays hidden
  unless signed in with a cloud project.
- **This project** rows are a small grid: label + control on one line, a ONE-line hint on
  its own full-width line under them (`grid-template-areas: "text control" "hint hint"`;
  the long form rides the row's `title=`). Codes is three labelled selects
  (Plumbing / Electrical / HVAC, DM Mono) in one line; Ceiling height stacks like Codes
  because its control (ceiling, make-up + the § chip) is wider than the card allows
  beside a label. **Quick keys** joined the section as a row (`#settingsQuickKeysRow`:
  the first three bindings as `1 WC · 2 Lav · 3 FD · +4`, plus the Edit link that keeps
  the `#settingsQuickKeys` id).
- **Footer**: one line of links, `Load project…` (`#settingsLoadProject`) and
  `Manage projects` (admin) with a **Help ▸** disclosure (`#settingsHelpToggle` →
  `#settingsHelpLinks`: keyboard shortcuts, the three tours, the engineered sample
  plan; folded again every open) on the left, `Clear Page` and `Advanced ▸` on the
  right. Phones: stacked rows, one code select per line, 44px targets.

Specs: settings-modal.spec.js re-pinned (order, hint-under-control, three code cells on
one line, subtitle, Help toggle, review row hidden after updateUI); tutorial.spec.js and
advanced-sample-plan.spec.js open Help before their door. Guide: how-to-do-a-pdf-takeoff
names the Help row.

---

## fix(output): Everything copies every layer on every sheet (2026-09-14)

Reported through Will: "when I try to Copy to /Tooling it is not moving over all of my
counters or lines." D25 (2026-09-13) had made Everything copy what was on screen, each
page's active layer plus the peek, unless the estimator ticked the other layers in the
picker; a project with marks on a layer that was not showing lost them on the paste, and
the pasted header named only the layers that made it. Will's call: "everything be every
layer on every page."

- **Everything is every layer on every sheet again**, whatever is on screen: the option
  runs the merged-annotations getter, and on a layered project the paste header reads
  `Counts, <project> · every sheet · every layer` (single-layer projects keep the bare
  `every sheet`, so those pins hold). The menu's picker still renders for Everything, with
  every layer ticked and locked under an "Every layer" title, so the menu says what the copy
  holds and nothing narrows it.
- **This sheet keeps option D**: pre-checked to what is on screen, pickable rows, and the
  header names the layers. Its ticks now survive a hover across Everything.
- Same on all three copies: Copy to /Tooling, Open in TakeoffTooling, Copy Summary.

Spec: copy-layers.spec.js re-pinned (Everything copies 11 with the peek off, the This
sheet tick, the email line). Docs: reports-and-exports + canvas-layers guides, the
ARCHITECTURE output.js row, _STAGE6 X6.

---

## feat(samples): the advanced sample plan (2026-09-14)

Will: "use both, A as the simple plan and B as the advanced plan." Candidate B from the parked
`wip/sample-plan-candidate-b` ships as `samples/sample-plan-advanced.pdf` (a restaurant
plumbing sheet, Main St Restaurant P-101), built by `npm run build:sample-plan-advanced`. It
opens through the intake from the empty canvas ("or open the advanced sample plan") and from
Project Settings; the three tours keep today's simple plan untouched. Candidate A (the
re-numbered office TI) stays under review: adopting it re-derives every tour coordinate.

---

## feat(samples): candidate A promoted to the simple plan — the design-build sheet (2026-09-14)

Rung 1 of [journeys/plans/SAMPLE-PLANS.md](journeys/plans/SAMPLE-PLANS.md): the simple plan
teaches design-build, so `samples/sample-plan.pdf` is now candidate A (Suite 200 Office TI,
A-101) rendered on a true ANSI B sheet with the plan at 9 pt/ft (`PLAN_AT` in
`scripts/sample-plan-candidates.js`: a drawing point lands at 60 + 0.75·px, 70 + 0.75·py).

- **Inputs, no answers.** A room schedule (areas, ceiling heights, type / occupancy, deck
  12'-0"), panel LP-1 on the janitor room wall, notes naming RTU-1 (2,000 CFM), the water
  service and gas meter, and "MEP design-build by contractor". No piping, duct or circuits.
- **Drawing fixes from the review:** the entry door swings into the lobby; the drinking
  fountains sit in a recess on the corridor's south wall.
- **The three tours re-pinned** (features/tutorial.js): the 20'-0" proof is the left-edge
  dimension from grid A to the corridor; the plumbing tour counts Women 108 (three WCs in
  stalls on the south wall, three lavs on the north counter — Men 107 has two of each plus
  urinals); the HVAC room box and the electrical spots sit in Open Office 105; the RFI asks
  about the end stall's ADA clearance. `tutorial.spec.js` bounds and the PEX footage (28.00
  ft: two 3.17 ft lav runs × 3 floors + three 3 ft risers) follow; hangers stay 15.
- **Guide screenshots regenerated** (`scripts/build-screenshots.js` re-pinned to the new
  fixtures, rooms, waste line and schedule; the drawing extent is 830 × 660 pt).
- `scripts/build-sample-plan.js` is now a thin renderer of candidate A; the first synthetic
  office plan is gone.

---

## fix(settings): Project Settings reachable on small viewports; the project rows as one section (2026-09-14)

Reported from a phone-sized window: the settings sheet had grown (Trade, Codes, Jurisdiction,
Ceiling height + make-up, three tour links) past the viewport, and its top, Save Project to
Cloud, sat off-screen with no way to reach it: a flex-centred card taller than its container
overflows equally above and below, and the part above the viewport cannot be scrolled to.
(Re-applied from claude/settings-modal-small-viewports, 2026-09-08, onto today's block.)

- **Safe centring for every modal.** `.modal-card` carries `margin: auto` and `.modal-overlay`
  scrolls (`overflow-y: auto`, `overscroll-behavior: contain`), so a card taller than the
  viewport starts at the top and the overlay scrolls instead of centring it off-screen. Card
  max-height also uses `dvh` (with the `vh` fallback) so mobile browser chrome does not eat
  the bottom.
- **One "This project" section.** Trade, Codes, Jurisdiction, Ceiling height + make-up and
  Use groups move out of inline-styled `.form-group` rows into a labelled section between the
  cloud actions and the footer; the app-level links (quick keys, shortcuts, the three tours)
  and Advanced come last. Every id is unchanged.
- **Phone layout.** Rows marked `-stack` wrap their control under the label at ≤768px: the
  trade segment goes full width with 44px targets, the inputs and selects grow to 44px tall.
- `settings-modal.spec.js` (4): the card fits and scrolls at 375×812 and 820×560, the last row
  is reachable, the trade segment and ceiling input work at phone width, the overlay scrolls
  even with the card's max-height removed, and the row order holds.

---

## feat(duct): D17 — the J19 stumbles (2026-09-13)

The drift patrol's J19 walk (journeys/duct-takeoff.md) and the J5/J6 re-walks filed five
things a design-build estimator trips on; this unit closes them.

- **Groups were a hidden precondition.** The duct surfaces that said "edit in Groups" /
  "(Groups)" pointed at a section a project keeps off until Project Settings → Use groups.
  Now the phrase is the door: the create modal's equipment-first line and the Bid Check
  "Systems within capacity" hint render a **Turn on groups** link while the gate is off
  (`App.turnOnGroups` flips it, expands the section, re-renders), and the first committed duct
  run on a groups-off project turns them on with one quiet toast — *"Groups are on — assign this
  run to a system in Groups."* — once per project (it fires only while the gate is off). Non-duct
  projects: zero change.
- **Deck height before any run.** Its only writer was the Duct Schedule modal, reachable only
  after a run existed, so the RTU main never got its auto riser. The setting now sits on the New
  Duct Run dialog (beside pressure class) and the Room Size dialog of an HVAC-shaped project,
  all three routed through ONE writer (`App.setDuctDeckHeight`) that also applies the riser
  RETROACTIVELY: every committed run whose vertex 0 sits on its system's equipment marker gets
  its `{ vertexIdx: 0, auto: true }` entry added / updated / removed on clear, a manual vertex-0
  entry is never duplicated, one undo step, a toast with the run count.
- **Copy Summary and Copy to /Tooling carry the pounds.** Both texts end with a `--- Duct ---`
  block of the Copy Schedule rows (per-size `size | gauge | LF | lb/ft | lb`, straight total,
  fittings total or the factor line, Bid weight), tab-separated, only when the scope has duct
  (`App.buildDuctCopyRows`). The copied-detail mirror buckets the block as `duct` (never
  ea/ft/px) and reads "duct (1,804 lb bid weight)"; a duct-only project now exposes the copy
  buttons. Copy Schedule's own text is byte-identical.
- **Multiply zones multiply duct** (J6-G). A run follows the LINE rule (both end vertices inside
  one zone → ×N; straddling counts once, silently, like a line), a fitting follows the COUNTER
  rule (its anchor point), through pure duct-model helpers (`ductRepeatFactorForRun/ForPoint`,
  `ductRepeatStraightItems`, a `repeat` field the two fitting tallies honor). Sidebar, schedule,
  legend, report and every copy read the multiplied numbers; where placed and with-repeats
  differ the schedule heading, the copy text ("Placed (before multiply zones)"), the report row
  and the sidebar badge titles say both (the T2-11 honesty). The zone dialog's preview names
  duct runs ("…, 1 duct run") through `countItemsInRect.ductRunCount`.
- **Duct and Polyline drafts are mutually exclusive** (J5-B). Arming one settles the other by
  its OWN commit rules first — a draft with ≥2 vertices commits, fewer cancels
  (`App.settleDuctDraft` / `App.settlePolylineDraft`) — so two finish bars can never stack and
  the Esc ladder (order unchanged) always unwinds the one draft that exists.

Tests: duct-stumbles.spec.js (all five), duct-model.test.js (the multiply math),
annotation-model.test.js (`ductRunCount`), report.test.js (the duct bucket). Docs: the duct
guide (groups, deck height, copies, zones), reports-and-exports, scale-zones-and-multiply-zones,
FEATURE-CATALOG, ARCHITECTURE Files rows, AGENTS persisted-settings note.

---

## fix(tutorial): the tour shows where, Back stays, the lavs say why — and a Close project door (2026-09-10)

Estimator feedback on the plumbing walkthrough (Wendi, relayed 2026-09-10): "it should show
you where the buttons are, not just explain"; "why are we chaining the lavs?"; "it won't let
me stay Back"; "we're counting hangers now?"; and "there should be a Close project that's
easier to find — I just refresh after I turn things in."

- **The spotlight follows the reader into a dialog.** A step's `target` is now a LADDER,
  deepest control first, and the render loop no longer goes dark the moment a
  `.modal-overlay` opens — with a dialog up, only a target INSIDE it qualifies (the
  header and sidebar sit under the backdrop, so they are never lit). The trade step
  walks + Add → the Quick tab → the Electrical segment; the counter steps light Add
  Counter / Create Counter; the line-type steps the Quick or Create tab and its Add; the
  chain and drop steps their floating palettes (and the + New counter dialog); the
  hangers step the Child counts row and the rulebook's suggestion; the ceiling step the
  Project Settings field; the circuit step the group dialog; the proof step the Summary
  row. `#tourOverlay` already sat above modals (z 320 > 200) and never intercepts the
  pointer, so no new machinery.
- **Back holds.** The render loop auto-advanced 900 ms after a doing-step's check read
  true — and a step re-entered with Back is by definition already done, so Back never
  stayed for more than a second, on any completed step. `goTo` now marks a backward move
  (`heldByBack`); a held step never auto-advances, its status reads ✓ Done and Next lights
  up. A forward move clears the hold, so an already-satisfied step still skips ahead.
- **The lavs say why.** The 1in PEX step names what the type is for (the cold-water branch
  that feeds the lav battery); the chain step contrasts it with the hand-counted water
  closets — the three lavs sit on one branch that runs lav to lav, so every click places
  the fixture AND the pipe that feeds it; the hangers step opens with why hangers are
  counted at all (every foot hangs from a support the bid has to count — and the app can
  do it from the pipe).
- **Close project, findable.** One routine, `App.closeProject({ route })` (app.js, the
  former Project Settings handler), now behind four doors: Project Settings (unchanged),
  a **Close project** row at the foot of the header cloud menu (shown once a project is
  open; never for a view-link session — `loadedViaViewLink`, NOT `isViewer`, so a reader
  who was just turned in keeps the door), a **Close project** link on the "Project turned
  in." toast (`#turnedInToastModal`, a static interactive card like Set-Scale-first;
  `App.showTurnedInToast`, features/turn-in.js), and a third button on the admin
  force-turn-in notice. The confirm now fires only when there is something to lose —
  unsaved edits (`getAutoSaveDirty`) or a takeoff that lives on this device alone — so a
  turned-in project closes on the click. Telemetry: `project_close` carries the route.
- **The header [Close].** Left of the edit-status banner, shown by `updateUI` only while
  VIEWING a cloud project this session edited earlier (the in-memory `editedProjectIds`
  set, fed whenever the session holds a project as its editor; cleared by the sign-out wipe,
  kept across Close project). After a turn-in the banner reads "[Check out to Edit]" and
  the way out sits right beside it; never while editing, never for a view-link session,
  never for a project only ever viewed.
- While there: the header cloud menu opened full-width — the open handler cleared the
  inline `right` to '' so the class's `right: 0` stayed in force beside the fixed `left`,
  and the off-screen measure clamped `left` to the margin. It now sets `right: auto` and
  the menu hangs under its button at its own width.
- Specs: tutorial.spec.js pins the hold (Back on a satisfied step stays 1.5 s, Next lit)
  and the in-dialog spotlight (Create Counter lit with the counter dialog open, + Add
  again once it closes); close-project.spec.js pins the row's visibility rules, the
  local-only confirm, the view-link exclusion, and both turn-in doors closing the project.

---

## fix(restore): the "Project from Last Session" offer waits its turn (2026-09-10)

Two sightings of the T1-01 prompt fighting the user. A plumbing tour's chained runs
vanished about ten seconds in when the electrical session's backup "restored itself"; and
on a slow CI runner the prompt appeared mid-test (duct-balance.spec.js, the export → import
round trip) and intercepted the next click. Both are the async boot landing late: auth and
the IndexedDB reads take as long as they take, and by the time `init` reaches the
takeoff-backup step, a `?tour=` walkthrough or a working user can already have pages on
screen. There was never an auto-keep timer — what looked like one was boot's silent
palette/page **pre-apply** (`applyTakeoffBackupToState`) writing the backup's
`pageCanvases` onto pages that did not exist when the boot started.

- **Deferral.** `openLastSessionRestorePrompt` (features/restore-last-session.js) now
  checks what is in the way: a running tour (`App.isTutorialActive()`) or another
  `.modal-overlay.visible` (the `?signin=1` auth modal, Set Scale, a counter dialog). Behind
  either, the candidate is held in a private `deferredRestore` — not `pendingRestore`, so
  the T1-01 write hold is NOT engaged (the modal-blocks-editing premise does not hold for
  a deferred offer, and work in progress must keep backing up; the candidate is safe
  regardless, on the held key the engine never writes). `App.retryDeferredRestorePrompt()`
  re-evaluates on a macrotask when the tour stops (`stopTutorial`) or any modal hides
  (`hideModal`), with a 1 s safety poll for overlays closed without `hideModal`; the
  macrotask matters for Project Settings → "start the tour", which hides one surface and
  opens another in the same handler. A session reset drops a deferred offer like it drops
  a shown one — nothing consumed, it returns next boot. Esc-dismiss, Keep, Discard and the
  held-record lifecycle are unchanged.
- **Nothing restores without Keep.** Boot's pre-apply runs only into a QUIET session:
  skipped when pages are loaded, the project is dirty, or a tour is active. A busy session
  still gets the prompt (the old session may be worth rescuing); only Keep replaces the
  work on screen. A quiet boot keeps the silent palette pre-apply exactly as before.
- `App.bootSettled` flips in init's `finally` so a spec that reloads and then acts can
  settle the boot instead of racing it. duct-balance.spec.js does, and clears the offer
  if the 5 s backup interval happened to land a promptable backup before its reload.
- Telemetry: `restore_prompt_shown` moved into the feature (logged when the prompt is
  actually on screen) and `restore_prompt_deferred` carries the blocker (`tour` / `modal`).
- restore-last-session.spec.js pins the modal deferral (no write hold, surfaces when the
  last modal hides, reset drops it) and, through the REAL boot held at its
  storage-persist await, the tour case (offer waits, the tour's plan and marks survive,
  the prompt comes at tour end, Discard leaves the takeoff alone), the busy-user case
  (prompt comes, nothing pre-applied over the two loaded pages), and the quiet boot
  (palette pre-applied, prompt up — T1-01 as documented).

What building it changed: the brief said "auto-keep", and reading for the timer found none
— the fix moved from the prompt to the pre-apply. The brief's "never restore over a busy
session unless Keep" was read literally rather than as "never prompt a busy session": a
silently skipped offer would lose the old session to the newer backup on the next boot,
while a prompt costs one click.
---

## feat(rules): the rulebook at the agent door (2026-09-10)

A digital twin could not find the rulebook or send what it teaches: the twin-facing
docs never mentioned `/rules/`, and the import door stripped a child count down to
name / qty / per / whole feet — a rulebook hanger (`intervalIn: 32`, `ruleId`) arrived
as "1 per 10 ft" with no rule.

- `import-takeoff` accepts `intervalIn` (positive inches, ≤ 1200; wins over `ftInterval`)
  and `ruleId` (the rulebook id grammar; a 400 names the field and points at
  `counttooling.com/rules/rules.json`).
- TAKEOFF_IMPORT.md documents both fields and gains **The rulebook** — where the list is,
  its shape, and the four rules of use: derive from a rule not from memory, stamp `ruleId`,
  say when the edition is not covered, public knowledge only.
- PipeTooling's twin docs (the CountTooling bid guide served as `get_ct_guide`, the app
  directory, the estimator brief) point at the rulebook in the same words — a separate PR
  there.

---

## feat(rules): slice 4 — Codes & jurisdiction (2026-09-09)

A rule's value depends on which edition a jurisdiction adopts, so a project now says.
Project Settings gains **Codes** (plumbing IPC/UPC by edition, electrical NEC, HVAC
SMACNA) and **Jurisdiction** (free text — "Texas · Austin") under Trade.

- `state.codes` holds only what the project chose; `getProjectCodes()` layers the device
  default (the last bid's choices, remembered on every change like the trade) and the
  app's defaults (IPC 2021 · NEC 2023 · SMACNA 2020) under it. Rides every persistence
  site beside `ceilingHeightFt`: the save payloads, hydrate, the IndexedDB backup, canvas
  JSON export/import, copy / load / pdf-intake. An old save resolves to the defaults.
- The rule popover's **This project** line names the edition and jurisdiction and carries
  the two honest warnings: *not checked against IPC 2024* when the rule's editions do not
  include the project's, and *cited from the IPC — this project follows UPC 2021* when the
  project's code family differs from the citation. Amendments on file are scoped to the
  jurisdiction; none on file says so by name.
- Bid Check ends with *Rules resolve for IPC 2021 · Texas · Austin — Project Settings*.
- `CODE_EDITIONS` / `CODE_DEFAULTS` / `normalizeProjectCodes` live in constants.js;
  `codes.spec.js` pins the rows, the dirty flag, the device default, the popover lines,
  the footer, and the persistence shapes.

What the self-critique changed: the mock-up's picker listed every authority having
jurisdiction; that is a database nobody maintains, so jurisdiction is a free-text field
and "not on file" is stated rather than implied.

---

## feat(rules): slice 3 — hangers from the rulebook, inch intervals, plumbing Bid Check (2026-09-09)

The plumbing rules stop being prose. `support-model.js` carries hanger spacing as the app
applies it (IPC Table 308.5: PEX 32 in at 1 in and smaller, 48 in above; copper 6 ft to
1-1/4 in, 10 ft above; PVC / ABS / DWV 4 ft; cast iron 5 ft), and the four `plumb.hanger.*`
rules point at it — `status: applied`, 44 values now pinned by the drift check.

- **From the rulebook** in the Child counts editor: a line type whose name declares a
  supported material and size ("1in PEX", '3/4" Cu') is offered its hanger row — `Hanger ·
  1 per 32 in`, with what it matched (PEX · horizontal · 1 in) and the § chip. Add stamps the
  rule on the child count, so the Summary row, the editor row and every export carry it.
  A name with no size gets the tighter spacing; CPVC is not PVC; fix the name, not the rule.
- **Inch intervals.** A per-ft child count may carry `intervalIn`, which wins over the
  whole-foot `ftInterval` (the editor gained a ft / in unit select). 48 in reads "4 ft".
  The engine, the Summary label, the report, the PipeTooling text and the agent-door
  evaluator all honour it.
- **Plumbing Bid Check**: an auto row, **Hangers on every supported run**, warns while a
  PEX / copper / PVC / cast-iron type carries no hanger count (and cites the rule); four
  manual rows — fixture units against the drain, trap arms, waste slope, backflow and
  water-heater venting — join the trade-neutral three.
- The plumbing tour's hanger step now takes the rulebook's row (1 per 32 in, stamped) —
  the sample's two runs and riser make 15 hangers across the ×3 zone.

What the self-critique changed: the mock-up also offered a riser clamp; the app cannot
split a run into horizontal and vertical, so that row was dropped and the rule pages say
the count runs on the tally length, drops included — tighter than the vertical rule, never
looser.

---

## feat(rules): slice 2 — the § chip and popover in the app (2026-09-09)

The rulebook reaches the estimator where the number is. `features/rules.js` fetches
`/rules/rules.json` at boot (now precached, so it works in the basement) and any surface
that DERIVES a number from a rule shows a small chip: the citation for a code, standard
or recommendation (`§ NEC Chapter 9`, `§ IPC 308.5`), the word `convention` for a working
figure. Click → one popover: the values as the app applies them, the section, the editions
checked, what in the app uses it, amendments on file, and the rule page. Never the code's
text. Counts the estimator clicked never carry a chip.

- Chips on: the Bid Check auto rows (the model's rows now say `rule:` — conduit fill and
  the voltage-drop recommendation), the Chain palette foot when the counter has a mount
  height (mount heights + make-up), the Duct Schedule's Gauge and lb/ft headers and its
  Seam & waste line, and the make-up field in Project Settings.
- Escape closes the popover in a capture-phase listener, so the app's Esc ladder never
  sees the key — the tool and any open modal stay as they were.
- The Duct Schedule's own literal copy of the knob defaults now reads
  `App.DUCT_SETTINGS_DEFAULTS` — the third copy the drift check could not see.
- `rules-chip.spec.js` pins the chip, the popover, Escape, the static chip, the Chain
  palette, and the precache; the model test pins the `rule:` ids.

---

## feat(rules): the rulebook, slice 1 — rules as source, the site, and the drift check (2026-09-09)

The line the product draws is public knowledge versus company knowledge: NEC fill, the
voltage-drop recommendation, SMACNA-style gauge, hanger spacing are the drawing's side
and belong in the app; shop spacing and labor stay with pricing. Until now the public
half lived only as numbers in code. Slice 1 writes it down once and makes code answer to
it.

- **Rules are Markdown with structured front-matter** — `content/rules/<trade>/<slug>.md`:
  a stable dotted `id`, `kind` (code | standard | recommendation | convention — mount
  heights are conventions, and the page says so), `status` (applied | draft), `values[]`
  as `when` / `value` / `unit`, `source` (code, section, editions, public URL),
  `amendments`, `used_by`, then prose that says what the app does and does not do with it.
  Thirteen rules ship: conduit fill, the 3% voltage-drop recommendation, the K constant,
  device mount heights, make-up (electrical); the gauge schedule, sheet weight, the Duct
  Schedule factors, room airflow (HVAC); hanger spacing for PEX, copper, PVC and cast
  iron (plumbing, `draft` — not yet wired to child counts). Cited by section, never
  reprinted; the Chapter 9 area tables stay in code.
- **`npm run build:rules`** renders `/rules/` — a rule card per page (the values as the
  app applies them, source, editions checked, used-by chips, amendments on file), a
  searchable index with trade filters, and `rules/rules.json` for the app and any AI.
  The site chrome moved to `scripts/lib/site.js` so Guides and Rules share one header
  (both now link to each other; the landing nav too); `build:guides` keeps `sitemap.xml`
  and lists the rule pages.
- **The drift check.** A value row may point at code — `bid-check-model.js#fillLimitFor(3)`,
  `duct-model.js#DUCT_GAUGE_TABLE["1"][0].gauge` — and `build:rules --check`, now in
  `npm run check`, resolves it by walking the module's exports (no eval) and fails when
  code and rule disagree. 34 values are pinned. To make them reachable,
  `VD_LIMIT_PCT_DEFAULT` and `VD_K` joined the Bid Check model's exports and the Duct
  Schedule knob defaults moved into `duct-model.js` as `DUCT_SETTINGS_DEFAULTS` (app.js
  spreads them; two literal copies gone).
- `rules.test.js` pins the parser, the pointers, the pages, the JSON and the sitemap.

What the self-critique changed before it shipped: `kind` was added when writing the mount
heights made it plain they are not code; `status: draft` was added so the plumbing rules
could be published honestly before the app applies them; the index cites the section and
the condition but reprints no table.

---

## chore(guides): regenerate the screenshots on the ANSI B sample plan (2026-09-09)

The 44 guide images (`guides/img/*.png` + the landing hero) were still captured on the old
918 × 594 sample sheet. `scripts/build-screenshots.js` now places markup as fractions of
the DRAWING's extent (`PLAN_W × PLAN_H` = 918 × 594 pt, the plan group on the 1224 × 792
sheet) instead of the page, frames every shot on the drawing (`fitPlan`, so the images keep
their old framing rather than showing the whole sheet), and routes canvas clicks through
`planPoint`. Three shots improved on the way: the takeoff shots show the live legend the
alt text promises, the Multiply Zone dialog now comes from the real two-click path so its
"In this area" count is the app's own (8 counters in Women 106), and the annotate note sits
clear of the Open Office label. Still manual, still not in `npm run check`.

---

## fix(tutorial): the screenshot walk — panel, ⋯ menu, off-screen targets (2026-09-09)

A step-by-step screenshot pass over the plumbing tour at a 1440 × 900 desktop viewport
(same engine as electrical) turned up three things the state-level checks could not see.

- **The Chain palette stayed open** from the chain step to Finish, covering the Pages
  section and the first sidebar rows. A do-it-for-me chain now ends the run and exits the
  tool, as Enter then Esc would — both tours.
- **Multiply Zone and Note live behind ⋯ More tools on desktop**, so their steps had no
  visible target and the card sat centred over the plan — over Men 105, exactly where the
  ×3 zone had just been drawn. Both steps now fall back to spotlighting `#headerMoreBtn`,
  and the copy says where the tool is.
- **Sidebar targets can be scrolled out of view** (Summary, Export Options); the first
  time a step spotlights a target it is scrolled into view.
- Copy now names the real buttons: Create Counter, Add Line Type.
- The electrical tour's do-it-for-me receptacles now land inside Open Office 104 (the
  old spots assumed a 792 × 612 page and put two of them on the Men's room lavatories).

Estimators also reported the electrical tour's **Set the scale** step as confusing. Reproduced:
the sample PDF was 918 × 594 pt — not a standard sheet — so the dialog greeted the step with
the "compressed or re-boxed" warning and a picker defaulting to ANSI D; following the card and
clicking 1/8" applied a 0.375 correction (the 65' building measured 173 ft) and dropped the
estimator into verify mode the card never mentioned. Four changes:

- **The sample plan is a true ANSI B sheet** (`scripts/build-sample-plan.js`: 17 × 11 in =
  1224 × 792 pt, the plan group at 0.75 inside it so every fixture keeps its PDF-point
  coordinates). The title block's 1/8" is literally true; no warning, no correction.
- **Prove the scale gates.** The step passes only when the 20'-0" wall reads within 0.6 ft of
  20; a wrong reading shows in the status line ("Read 53'-4" — go Back and set the scale
  again") via the new optional `hint()` on a step. `state.lastMeasure` now carries `pts` +
  `scale` so the reading can be re-derived in feet.
- **The electrical tour gets the same proof step** right after Set Scale (14 steps now); both
  tours share `SCALE_STEP` / `PROVE_STEP`.
- **The scale step's copy says what the dialog shows** (the Architectural & Engineering tab,
  the 1/8" = 1' row), and its Do-it-for-me opens the real dialog and clicks that row, so the
  estimator sees it once; a direct write remains the fallback.

---

## feat(tutorial): the plumbing walkthrough — a second tour on the same engine (2026-09-09)

The electrical tour shipped first because that trade's features were the newest; the
plumbing tour covers the app's home trade. `features/tutorial.js` now holds ONE engine
and two step lists (`TOURS.electrical`, `TOURS.plumbing`); nothing in the overlay,
the check/advance loop or the do-it-for-me plumbing changed.

- **Fourteen plumbing steps**, each teaching one idea the electrical tour does not:
  open the sample plan → the 1/8" preset → **prove the scale** with Measure on the
  20'-0" dimension under Women 106 (the footer reads 20'-0") → a Water Closet counter
  with the plumbing set's Toilet symbol → count the three DRAWN water closets of Men
  105 → a "1in PEX" line type from the Quick tab → chain the three lavatories → a 3 ft
  riser with the Drop tool → a Hanger child count (1 per 4 ft) → a ×3 multiply zone
  around Men 105 → an "RFI:" note → the Summary proof modal → the PipeTooling hand-off
  → done. The refinement pass dropped a Groups step (the ×3 zone is the stronger
  story in that slot; groups get a sentence in the done step) and chose a water line
  over waste because the Quick tab's stock materials include PEX and not PVC — the
  two-click point would have been lost to a typed name.
- **Sample-plan geometry in PDF points.** The PDF is 918 × 594 (the SVG source at
  0.75), so the do-it-for-me marks land on the drawn fixtures: water closets at
  y ≈ 289, lavatories at y ≈ 424, Men 105 = (322, 266)–(465, 442).
- **The trade is stamped, not remembered.** A device whose last bid was electrical
  keeps that as its default trade; the plumbing welcome step sets the project to
  plumbing (`setProjectTrade`, `remember: false`) the moment the plan is open, so
  the Quick pickers speak plumbing without changing the device default.
- **Per-tour done keys.** `clickcount-tour-done` (electrical, unchanged) and
  `clickcount-tour-done-plumbing`: finishing one hides only its link in the
  empty-canvas hint (now "take the five-minute tour: plumbing · electrical"), and
  the whole offer goes when both are set. Project Settings has "plumbing tour" /
  "electrical tour"; `?tour=plumbing` / `?tour=electrical` open them on load and
  `?tour=1` still means electrical.
- One new publish-only registry entry: `App.commitMeasurePoint`, so the Measure
  step's "Do it for me" goes through the real two-point commit (toast + footer chip).
- `tutorial.spec.js` walks the plumbing path end to end and pins the entry points.

---

## fix(tutorial): the empty-canvas tour link survives a mixed shell (2026-09-08)

First report after the tutorial shipped: "take the five-minute tour" was not clickable. The
service worker serves `app/index.html` network-first and `styles.css` cache-first, so a
returning tab renders the new HTML (link present) against the previous version's stylesheet
(no `.canvas-empty-hint-tour a { pointer-events: auto }`) until the updated worker takes
control — and the hint container's `pointer-events: none` swallowed the click. Reproduced by
routing the pre-tutorial stylesheet under the live page: the click landed on `#canvasWrapper`.

- The `<a>` now carries `style="pointer-events:auto"` inline in the HTML, so the link is
  clickable whichever stylesheet the shell paired it with. The CSS rule stays for the
  z-index and colour.
- `tutorial.spec.js` gains a mixed-shell guard: the current stylesheet with that rule
  stripped, a real mouse click, the tour starts.
- The general one-load mismatch is already handled by the `controllerchange` reload in
  app.js when nothing would be lost; this case slipped through because a mid-propagation
  visit can abort the new worker's verified install and leave the old shell in charge.

---

## feat(tutorial): the interactive walkthrough — learn the app by doing an electrical takeoff on the sample plan (2026-09-08)

The stage after the six electrical slices. `features/tutorial.js` is a coach-marked tour over
the REAL app, not a slideshow: thirteen steps from opening the sample plan through setting the
scale, switching the trade, adding a receptacle with its mount height, counting three, making a
3/4" EMT type with conductors, setting the ceiling, chaining a run (the drops appear), tagging a
circuit, reading the Summary's wire rows, opening Bid Check, and the hand-off — ending with a
real takeoff on screen.

- Each doing-step spotlights the control (`#tourSpot`, a box-shadow cutout that never
  intercepts the pointer) and advances the moment `check()` sees the state change, whichever
  way the user made it; every doing-step also offers **Do it for me**, which goes through the
  same App.* entry points a click would. Reading steps advance on Next.
- Entry points: the empty-canvas hint ("new here? take the five-minute tour", hidden once
  `clickcount-tour-done` is set), Project Settings → tour, and `?tour=1`. It refuses to start
  over an open cloud project. Telemetry `tour_step`.
- No new dependencies; the card sits above modals and below toasts; leaving mid-way keeps the
  work done so far.

## feat(electrical): S6 — read the tags: the text layer picks the fixture type, the schedule builds the palette (2026-09-08)

Slice 6 of Electrical, First-Class — the last of the six moves. Lighting is counted by a
letter beside the symbol, and that letter is in the PDF's text layer with coordinates.

- **The text layer, in app space** (`features/tag-reader.js` `pageTextItems`): pdf.js
  `getTextContent` on the page's own proxy, each item's corners run through the page's
  scale-1 viewport into the annotation coordinate space (the same space `canvasToPdf`
  produces), cached per session. Regex over text, no model, offline. Honest about scans: no
  text layer, no suggestion, the click behaves exactly as before.
- **Tag-aware placement.** With the Counter tool on an electrical project the cursor reads
  the nearest tag — a chip says *Plan says B → Type B* and rings the letter it read; the
  click lands on the counter whose tag matches (`tag-model.js` `tagOfCounter`: an explicit
  `counter.tag`, else a name like "Type B" / "B — 2x2 troffer"), so one tool covers every
  fixture type instead of switching counters per click. No counter for the tag? Enter
  creates "Type X" (tagged, the letter icon) and makes it active.
- **Palette from the schedule.** `TOOL.SCHEDULE` (the Create tab's "Read a schedule from
  the sheet…" link; a rect tool like Room Sizer) — drag a box over the fixture schedule and
  the rows inside are proposed as counters, tag + description, existing tags unticked,
  one confirm. Counters are named by their tag ("EM — Emergency wall pack") so they read
  back as tags.
- The details modal gains a Fixture tag field; the agent door accepts `counters[].tag`;
  telemetry `tag_suggestion_accepted` (click / enter-create / schedule). The panel schedule
  gesture (poles from a box) is deliberately not built: panel schedules vary too much in
  layout for a regex to be honest about.

## feat(electrical): S5 — Bid Check: the app says what it knows and asks what it cannot (2026-09-08)

Slice 5 of Electrical, First-Class — the panel the duct plan specified, built electrical-first
(duct's rows drop into the same table later).

- **A Bid Check section in the sidebar** (`features/bid-check.js`), collapsed by default with the
  open-item count on its header. **Auto rows** are rule functions over the app's own tallies and
  show their work: conduit fill against Chapter 9 Table 1 ("1/2" EMT · 10 #12 THHN · 43.8% ⚠ →
  3/4" EMT 25% ✓"), voltage drop to the farthest device (2·K·I·L/CM with the circuit's smallest
  hot gauge, its load or the project default, the gauge that passes named), circuits on plan vs
  the panel schedule, and every device on a circuit and reached by a run. **Manual rows** are the
  judgment calls (scope vs drawings, addenda, scale verified; for electrical: fire alarm at rated
  corridors, lighting controls, equipment connections, temporary power, pull points), ticked per
  project. Every project sees the trade-neutral rows; electrical projects see the rest.
- **Pure rule table** `bid-check-model.js` (NEC tables + `conduitFill` / `voltageDrop` /
  `bidCheckAutoRows` / `bidCheckOpenCount`), node-tested against the report's appendix figures.
- **Persisted**: `state.bidCheck` (`manual` ticks + `loadAmps` / `volts` defaults, editable inline)
  rides every save/load/export/import path; telemetry `bid_check_row_state`.
- **Advisory at the gate**: after Copy to /Tooling, Open in TakeoffTooling and Export PDFs, an
  interactive toast names the open items with a Review link — never a block. The report gains a
  Bid Check section, the email a block, the payload `checks`. Agent door (v2): `bidCheck`.
- Circuit schedule rows now carry `hotGauges` (S4) so the voltage-drop row can pick the gauge.

## feat(electrical): S4 — circuits: a group with a panel tag, the homerun arrow, the circuit schedule (2026-09-08)

Slice 4 of Electrical, First-Class. A **group gains one optional tag** — panel and circuit
("LP-1 · 7", plus the load the voltage-drop check will assume) — the same single field the
duct plan adds for systems. With it:

- **Panels are counters.** A counter with `panelName` / `poles` is the panelboard on the
  plan; its marks are where the circuit's distance is measured from, and its pole count is
  what the **cross-check** compares circuits on plan against ("LP-1 · 31 on plan · 42
  scheduled ⚠") — under the Groups list, in the report, the email and the payload.
- **Homeruns.** A line type or a single run flagged `homerun` draws the arrowhead-to-panel
  at its end with the circuit tag beside it (canvas-draw.js `drawHomerunArrow`, once for the
  live overlay and every export) and reports apart from device-to-device runs.
- **The Circuit schedule** (`features/circuits.js` `getCircuitSchedule`, the pure graph in
  `circuit-model.js`): per panel, each circuit with its devices served, conduit / homerun /
  wire feet (wire from S3's `getConductorTotals`) and the **farthest device** along the runs
  — Dijkstra over the circuit's runs from the panel mark, else from the homerun's far end,
  devices off the runs counted apart. A new report section, an email block, and
  `circuits` + `panels` on the TakeoffTooling payload. Copy Summary is unchanged (its rows
  already carry the group prefix).
- **Chain inherits the circuit.** With no group active, a chain continues the group of the
  run it extends (`chainStart.group`), so a circuit is picked once, not per tap.
- Editors: the group modal's Circuit row (a datalist of known panels), Panel name + poles on
  a counter, Homerun toggles on a line type and in Line Properties — shown for electrical
  projects or items already carrying the fields. Agent door (v2, additive): `groups[].panel`
  / `circuit` / `loadAmps`, `counters[].panelName` / `poles`, `lineTypes[].homerun`, line
  `homerun`.

## feat(electrical): S3 — conductors on the run: wire by gauge, cable, tick marks (2026-09-08)

Slice 3 of Electrical, First-Class. A run stops being a plumbing line with an electrical
name: a line type carries a **raceway** (kind + size) and a **conductor list**, and every
surface that tallies lines now produces three kinds of row instead of one.

- **Model** (`conductor-model.js`, pure, node-tested): `parseConductorSpec` reads the trade's
  shorthand (`3 #12 THHN + 1 #12 G`) into `[{ n, gauge, insul, role }]`; `wireRowsFor` rolls
  hots + neutrals of a gauge into one row and keeps the ground its own ("#12 THHN green");
  `cableNameFor` names MC / AC / NM runs ("MC 12/2 w/G") — cable raceways emit ONE cable row
  and NO wire rows, because the conductors are inside; `tickLayout` orders the hash marks.
- **Engine** (`features/conductors.js`): `getConductorTotals` walks the runs once — wire =
  `split.feet × n` per gauge rolled up ACROSS line types per group; cable per MC type; a
  counter's `cablePerCount { ft, name }` adds count × ft (150 ft of Cat6 per data drop);
  px runs excluded and flagged, the T1-05 rule. A single run may carry its own `conductors`
  (one shared homerun, three circuits' worth) — `conductorsForLine` prefers it.
- **Surfaces**: the Summary section (⚡ derived rows), the sidebar Summary
  (`.summary-derived-item`), Copy Summary (`ft of #12 THHN` — importers already read `ft of`),
  the TakeoffTooling payload (`derived: 'wire' | 'cable'`, `type: 'wire'` so its book prices
  them and its explode never adds conductors twice), the email text, and `takeoff-eval`
  (`wire` / `cable` buckets in `tally`, rows + summary counts in `diffTakeoffs`).
- **On the sheet**: `drawConductorTicks` in the draw core — one 60°-slanted hash per
  conductor at the run's midpoint (polylines: the longest segment), the neutral half again
  as long, the ground dashed; per line type (`tickMarks` defaults on with conductors), drawn
  once so the live overlay and every export carry them. Pixel baselines untouched (the
  fixture has no conductors); `canvas-draw.test.js` counts the strokes.
- **Editors**: the details modal's Raceway & conductors block (kind / size, the shorthand
  field with a parsed hint and a refusal on junk, the ticks toggle) and Cable per count on
  counters — shown for electrical projects or any item already carrying the fields; Line
  Properties gains the per-run override with the inherited list as its placeholder.
- **Agent door (v2, additive)**: `lineTypes[].raceway` / `conductors` / `tickMarks`, line
  `conductors`, `counters[].cablePerCount`, all validated. Contract: TAKEOFF_IMPORT.md.
- Deliberately out (decision ⚑3 revisited): no waste factor here — CountTooling emits true
  conductor feet; waste is a pricing assumption and lives in TakeoffTooling's book.

## feat(electrical): S1 + S2 — the Trade switch, the electrical symbol set, mount heights and vertical by default (2026-09-08)

The first two slices of Electrical, First-Class (the design brief "Electrical, What
Changes"). One machine, one Trade switch: a plumbing user sees one new control; everything
electrical appears only when a project's trade is Electrical.

- **Trade switch (S1).** `#counterQuickCountTradeSegment` on the Quick tab and
  `#settingsTradeSegment` in Project Settings stamp `state.trade` (per project, explicit —
  decision ⚑2) via `setProjectTrade`; the Quick tab also remembers it as the device
  default (`plumbingModifiers.defaultTrade`). The Quick creator is ONE panel for every
  trade: the rows keep their storage keys and `TRADE_QUICK_PROFILES` (constants.js)
  relabels them — Electrical reads Category / Variant / Rating and composes "Duplex
  Receptacle 20A". Per-trade stores (`getTradeModifiers` / `saveTradeModifiers`) live
  under `plumbingModifiers.profiles[trade]`, seeded from `ELECTRICAL_DEFAULTS` /
  `HVAC_DEFAULTS`, so the cloud Artboard carries them with no migration. `trade` now also
  rides Export Canvas JSON, the IDB backup restore, the shared hydrate, copy-project and
  the pending-canvas intakes (it was missing from all five). Telemetry: `trade_set`.
- **Electrical symbol set (S1).** 41 drafting-convention symbols generated by
  `scripts/build-electrical-symbols.js` into `my-counters/electrical/` and folded into
  `icons-custom.js` by `build:icons`, which now reads subfolders as icon SETS (`set` on
  every entry; `<title>` display names; `<desc>terms:` search terms). The custom icon
  grids group by set with a heading per set, the project's trade first
  (`customIconCellsHtml(icons, selected, firstSet)`). Electrical variants pre-select
  their symbol (`tradeIconForType`, by name).
- **Mount height (S1).** `counter.mountHeightIn` (inches AFF; `parseMountHeightIn` /
  `formatMountHeightIn` in geometry.js accept 18, 44", 4'-0", 6 ft) on the Create tab,
  the counter details modal and the Quick tab (prefilled per variant from the profile's
  `mountByType`: 18 receptacle, 44 GFCI, 48 switch, 78 panel). Set-only like `cfm`; rides
  every payload wholesale; carried through My Standards adds.
- **Vertical by default (S2).** Project Settings gains Ceiling height + make-up
  (`state.ceilingHeightFt` / `state.makeUpFt`, all four builders + seven hydrates; telemetry
  `ceiling_set`). The Chain tool writes `defaultVerticalFeet(ceiling, mount, makeUp)`
  (line-metrics.js) as an ORDINARY drop at every tap — the arriving run's `endDrop`, the
  first device's as the first run's `startDrop` — so each device is counted exactly once at
  chain joints and totals / reports / exports need nothing new. A Room Sizer room at the
  point overrides the project ceiling (`App.roomHeightAtPoint`). The status bar coaches
  the next tap ("+9.5 ft drop at Duplex Receptacle"). Telemetry: `drop_set` route
  `chain-default`.
- **Agent door (v2, additive):** `counters[].mountHeightIn`, `ceilingHeightFt`, `makeUpFt`
  are stored (never used to derive drops — a twin sends them itself). Contract:
  [TAKEOFF_IMPORT.md](TAKEOFF_IMPORT.md).
- Specs: `trade-quick.spec.js`, `chain-vertical.spec.js`; unit tests for the three pure
  helpers. Deliberately not in this slice: assembly templates (they live in TakeoffTooling's
  explode kernel), conductors (S3), circuits (S4).

## feat(agent-door): takeoff.json v2 — groups, child counts, drops, zones, trade (2026-09-07)

The agent door (`import-takeoff`) spoke half the app's language: every mark landed with
`group: null`, and there was no way to express child-count rules, the verticals at line
ends, typical-floor multiply zones, detail scale zones, or which trade the takeoff was.
A twin could place a receptacle and trace a homerun but not say which circuit either
belonged to. Engineering item E3 of the Electrical Fleet plan.

- `takeoff.version: 2` adds `trade`, `groups[]`, mark/line `group`, palette `childCounts`,
  line `startDrop`/`endDrop` (feet → the Drop tool's own shape), page `multiplyZones` /
  `scaleZones` (stamped on every canvas of the page — the zone lookup is per canvas).
  v1 stays strict and refuses v2 fields by name. Response adds `group_count`,
  `zone_count`, `child_rules`, `trade`. Contract: [TAKEOFF_IMPORT.md](TAKEOFF_IMPORT.md).
- `state.trade` (`'plumbing' | 'electrical' | 'hvac' | null`) rides the three save-engine
  data builders, cloud load, canvas-JSON import and the Open in TakeoffTooling payload
  (`project.trade`) — the default-destination hint the hallway plan asked for.
- `takeoff-eval.js`: `tally` returns `groups` (per-group counts + feet) and `children`
  (rule totals: per count × marks, per run × runs, per ft × ceil(feet/interval) per scaled
  run — px runs excluded); drops ride the feet bucket; `diffTakeoffs` returns `children`
  and `groups` rows with the same verdicts. Tests in takeoff-eval.test.js.
- Roads not taken: applying multiply zones inside the eval (marks are scored as physically
  placed, the reviewer's view); inferring a trade from palette names (the door states it
  or leaves it null).

---

## feat(output): Open in TakeoffTooling — the electrical hand-off as facts, not a name convention (2026-09-07)

TakeoffTooling is where an electrical takeoff gets exploded into assemblies, labored from the
MC book and priced; until now it received CountTooling's counts as the /Tooling clipboard text
and inferred everything from the names (its importer predated the T1-05 units, the indented
child counts and the `[Group]` prefixes, and kept two rows in nine). The new sidebar action
opens TakeoffTooling with its structured `#import=` payload v2 instead.

- `report.js` `getTakeoffToolingPayload(options)`: the `collectSummaries` + child-count walk,
  emitted as `{ description, quantity, unit: ea|ft|px, pages, group, children }` items with the
  project name. Children nest under their own parent; a line type with both scaled and unscaled
  runs emits an `ft` row and a `px` row.
- `features/output.js` `doOpenTakeoffTooling` + the `#forTakeoffToolingDropdown` scope menu
  (this sheet / every sheet / everything), behind the same pre-copy scale gate as Copy to
  /Tooling; opens the tab inside the click and attaches the view link as `project.plansUrl`
  once it resolves. Shown with the /Tooling button; closes and is closed by the sibling menus.
- Contract fixture: `takeoff-handoff.fixture.txt` (the /Tooling text for a seeded project) is
  asserted here and in TakeoffTooling's import tests, so a third app can no longer fall behind
  the export silently.
- Docs: FEATURES, ARCHITECTURE (Output + search hints), the reports-and-exports guide.
- Roads not taken: sending the text and letting TakeoffTooling keep inferring (the failure
  mode this fixes); a shared vocabulary file (comes with the electrical Trade profile).

---

## feat(view-links): viewer grants — a sub opens plans from their PipeTooling portal with no email gate (2026-09-06)

View links open with no account, but the email gate refused anyone outside the company
domain — so a subcontractor's Gmail hit "use your work email". PipeTooling already knows
who the sub is (their portal link is the credential it trusts), so its sub-portal function
now mints a short-lived **viewer grant** and appends it to the plans link as `&g=`:
`base64url(claims).base64url(HMAC-SHA256)` over a secret both projects hold
(`PT_VIEW_GRANT_SECRET` here, `COUNTTOOLING_VIEW_GRANT_SECRET` there), claims
`{ t, name, email?, person?, via, iat, exp }`, bound to one token, good for a day.

- `supabase/functions/_shared/viewGrant.mjs` — the kernel (`mintViewGrant` /
  `verifyViewGrant` / `parseViewGrant`): plain ESM + Web Crypto, so the file Deno runs is
  the file Node tests (`view-grant.test.js`: round-trip, token binding, expiry, tamper,
  wrong secret, unknown source, malformed never throws).
- `get-view-project` — a request with `grant` is verified and skips the domain gate; the
  access-log row carries `viewer_name` + `source` (migration `20260906000000_view_link_access_log_viewer`,
  with a fallback to the old row shape if the function lands first). An invalid grant answers
  `403 grant_invalid`. Requests without a grant are byte-for-byte the old path.
- `features/view-only.js` — reads `g`, skips the email modal, sends the grant, and on
  `grant_invalid` drops to the gate with the server's message. Granted viewers are not
  remembered as an allowed email (the portal re-mints on every open).
- `features/share-links.js` — the access log reads "Behar Kraja · via PipeTooling portal".
- Docs: SUPABASE_SETUP (secret + migration), FEATURES, ARCHITECTURE. Spec:
  `view-only.spec.js` gains the grant boot and the fallback.
- Roads not taken: widening the domain allow-list (opens every link), a per-link
  "anyone with the link" switch (the bid's link also goes to GCs), registering sub emails
  (a bridge call per sub, and they still type), PipeTooling serving the PDF (loses the marks).

## feat(user-admin): per-row "Email sign-in link" — the locked-out rescue without a phone call (2026-08-31)

Manage Users rows gain a ✉ button (first in the icon group, before Set
password): it emails that user the same no-create one-time magic link the
sign-in modal's fallback sends, via the new shared `App.sendSignInMagicLink`
registered by features/auth-magic-link.js (same `shouldCreateUser: false` +
`/app/` redirect + `friendlyOtpError` wording). Toast feedback; the button
stays disabled through GoTrue's 60s per-email rate-limit window. Set
password stays for the hand-them-a-password cases. Mirrors PipeTooling's
office-side "Send email to sign in" (Active Accounts), so both apps now have
admin-initiated passwordless rescue. Guide: admin-handbook (Set-password
bullet rewritten — it's no longer "the" locked-out path). Spec:
auth-magic-link.spec.js gains 2 registry-driven tests for the shared sender.

---

## fix(render-worker): awaited destroy — re-adoption no longer falls the session back to main

Production telemetry (`user_activity.render_worker_fallback`, recorded since
2026-08-10) showed 25 events across 6 users, all `doc-load: PDFWorker.fromPort -
the worker is being destroyed…`. Root cause, deterministic on every
RE-adoption (project switch, re-upload, page append — any new pdf.js document
after the worker already held one): [render-worker.js](render-worker.js)'s
`load` handler called the previous document's `doc.destroy()` **without
awaiting it** and invoked `getDocument` on the next line. pdf.js caches one
`PDFWorker` per `GlobalWorkerOptions.workerPort` (`PDFWorker.fromPort`);
`loadingTask.destroy()` marks that cached worker `_pendingDestroy`
*synchronously* and clears it only after the async transport teardown — so the
immediate `getDocument` hit `fromPort` mid-destroy, threw, the load reported
`ok:false`, and [render-service.js](render-service.js) `failWorker`'d the whole
session into main-thread rasters (the perf layer silently lost until reload).

Fix (worker-side sequencing): `load`/`dispose` are now serialized through an
internal promise chain and every `destroy()` is awaited before the next
`getDocument` touches the shared port. This also fixes the latent
superseded-mid-load hazard where destroying a stale document tore down the
port-cached `PDFWorker` under the newer document's feet. A raster that dies
because its generation was superseded mid-flight now reports `cancelled`
instead of an error (an error result also session-failed the worker).
`docGen` is still stamped synchronously on message receipt so queued stale
loads skip themselves.

Regression: [render-worker.spec.js](render-worker.spec.js) "rapid double
project-load stays worker-rastered with zero fallbacks" — two back-to-back
re-uploads must re-adopt to `ready` each time (previously `failed` on the
first), then a forced cold raster proves worker mode with zero fallbacks.
Verified red on the old worker code, green on the fix.

## feat(drops): drop-size peek + "Drop sizes" toggle (view-mode readable drops)

Field request (wendi, viewing a shared plan): *"ability to see drop distances
in view mode that is not clunky / getting in the way."* Drops rendered only as
their endpoint glyph; the value lived in Line Properties, which viewers cannot
open. Two tiers of disclosure, zero pixels added at rest
([features/drop-peek.js](features/drop-peek.js)):

- **Peek** — with the Move tool, hover (or tap — the synthesized touch click
  rides the same handleCanvasClick path) a drop marker for a DOM chip naming
  the line type and the drop in its stored unit; click pins it; any
  pointerdown / wheel / keydown dismisses it, so a pan, zoom, page flip,
  rotate, or undo can never strand a stale chip. Hit-testing rides
  `collectDropNodes`, so a chain joint peeks its ONE carried value.
- **"Drop sizes" toggle** — `#dropSizesBtn` beside the Hide-marks eye (burger
  drawer row on mobile), painting a small white value chip beside every drop
  glyph via the new `env.showDropSizes` in canvas-draw.js's
  `drawAnnotationsCore` (placement: outward along the run, pushed past the
  glyph by the chip's own extent). Live overlay only — export/print envs never
  set the flag. Shown only when the project has drops. Persisted per device
  (`view:dropSizes:<token>` for view links, restored beside `view:hideMarks`;
  `clickcount-show-drop-sizes` otherwise) — a visual preference like
  hide-marks, deliberately not in project save/load.

canvas-draw gained `deps.formatDropLabel` (the recent-drops.js formatter).
Tests: the drop-size-label unit test in
[canvas-draw.test.js](canvas-draw.test.js) +
[drop-peek.spec.js](drop-peek.spec.js) (real-hover peek, pin, all three
dismissals, toggle gating/persistence/reload, armed-tool + hide-marks
silence).

---

## feat(export): Copy to /Tooling confirmation reports counts vs line feet

The "Copied to clipboard." confirmation after **Copy to /Tooling** now carries
a second line with the by-unit split of what was copied — "29 counts (1,122 ea)
· 6 line types (444.74 ft)", plus "· N unscaled runs (X px)" when an Export-
anyway copy included unscaled lines. It is the mirror of PipeTooling's import
toast (its `countRowUnit` kernel, v2.2113 there), so an estimator can reconcile
copy against import at a glance; counts and feet are never summed together.

- report.js: pure `summarizeToolingExport(text)` reads the export text back and
  buckets rows by the name prefix (`ft of` → ft, `px of` → px, everything else
  incl. indented child rows → ea; `[Group] ` prefix tolerated; view-link footer
  and blank lines skipped) + `formatToolingExportSummary(s)`; both on `window`
  and in the CommonJS test footer (3 node tests in report.test.js).
- features/output.js: `doCopyPipeTooling` fills `#pipeToolingCopiedDetail`
  (new `<p>` in the modal, hidden when empty) and holds the modal 2.6s instead
  of 1.5s when there is a split to read; the no-link toast paths append the
  split; the Copy Summary path clears the detail so a stale split never rides
  along. The export TEXT is unchanged — the importer contract is untouched.

## feat(ghost): the Ghost / Stamp tool — copy a typical as a reference overlay

New header tool (⋯ menu "Ghost / Stamp", hotkey G, TOOL.GHOST): rubber-band a
batch of placed counters + lines (same two-corner gesture and both-ends-inside
capture rule as Delete Area, via `collectItemsToDeleteInRect`) into a 35%%-alpha
reference copy that rides the cursor to placement, drags as a batch, and can be
STAMPED down as real counted marks — a 4-restroom floor is capture once, drop/
stamp four times. Ghosts are a DISTINCT annotation kind (`ann.ghosts[]`, src
annotation-shaped in absolute PDF-space) so no tally surface — footer, sidebar,
Summary, legend, report, Copy to /Tooling, Copy Summary, PDF exports — can read
one; `stampGhostIntoAnnotations` is the single door to counted marks (fresh
ids, undo snapshot; the stamp toast names the recovery: "Stamped in error?
Ctrl+Z undoes it."). Per-ghost right-click menu: Stamp / Show counts / Show
runs / Delete. Rides save/load + export/import + the IndexedDB backup through
the one `applyPageAnnotationsFromData` sanitizer; rotates with the page via the
existing per-kind walker; drawn on the live overlay only (never the export
path, like the grid), composited through a scratch buffer so the batch fades
evenly. Drag uses the note-pattern `justFinishedDragGhost` click swallow (the
browser's post-mouseup click must not arm a capture corner — pinned by a
real-pointer-events spec); the drop click carries the ghost by the final delta
so touch (no mousemove) works. Model half pure in annotation-model.js
(`captureGhostFromRect` / `ghostCounts` / `ghostBounds` / `translateGhost` /
`stampGhostIntoAnnotations` / `ghostIndexAtPoint`, unit-tested); gesture + menu
in features/ghost.js. Regression: [ghost.spec.js](ghost.spec.js) (6 tests).
## feat(drops): fast drop entry — fixed modal, recent sizes, repeat row, Drop tool

A drop (vertical rise/fall at a line end) used to cost ~6 actions through the
Line Properties round trip, once per end — and a chained branch has one end
per fixture. Shipped as three stacked steps (each stands alone):

**Step 0 — fix what a faster path would multiply.** The drop fields parsed
with `parseInt`, silently truncating a typed 10.5 to 10 while the field kept
showing 10.5; they now parse decimals and ft-in shorthand ("8'6", feet only —
in other units a plain "8" would misread as 8 ft) via `parseRealWorldLength`,
and every commit echoes the stored value back into the field. Close (and
Escape-close) snapshotted AFTER mutating, so the first Ctrl+Z was a no-op —
every path now funnels through one `commitDrop` that snapshots first. And a
plain open-then-Close marked the project dirty and burned an undo slot; now
only a real change does.

**Step 1 — recent sizes, surfaced twice + the repeat row.** New pure module
recent-drops.js (`nextRecentDrops`, `formatDropLabel`, max 5) behind the
device-local `state.recentDrops` store (localStorage `recentDrops`): one-click
Recent chips in Line Properties above each ± row, and a context-menu
**"Drop N ft here"** row (last-used size, applied to the clicked line's
nearest end — the right-click point rides `ctxTarget.pdf`). Every set reports
a `drop_set` event carrying `{value, unit, route}`, so which entry path
estimators actually use is finally measurable.

**Step 2 — the Drop tool** (`TOOL.DROP`, hotkey B, features/drop-mode.js).
Header button arms it; every line end on the page renders a labeled target
ring; one click per end writes the palette's size, the same size again clears
(click-to-toggle), each click one undo step. Writes go through the pure node
model in annotation-model.js (`collectDropNodes`/`applyDropToNode`):
coincident line ends — every chain joint — collapse to ONE node whose drop
lives on exactly one end, so shared points can never double-count vertical
footage (and re-stamping a point repairs a legacy duplicate). The `#dropPanel`
palette reuses the Chain-panel idiom (draggable via `dropPanelPos`, closable
without leaving the tool, Esc ladder: close panel → exit tool) and lists the
shared recents + a custom value/unit entry. Regressions:
[drop-mode.spec.js](drop-mode.spec.js) (3 tests) + node tests for the recents
core (constants.test.js) and node model (annotation-model.test.js).

## fix(settings): Project Settings composition quick wins (B18)

From the 2026-08-17 Project Settings composition audit (JOURNEY-MAP.md B18):
deleted the Advanced modal's "Export PDF" button — it invoked the identical
`App.downloadProjectPdf()` as the main modal's "Download PDF", one action under
two names in two menus; demoted "Export Canvas" from Advanced's yellow primary
(the loudest button in the modal was the marks-only-JSON backup — the
wrong-file-to-GC trap B4 documents); retired the triple-verb
"Name / Upload / Save Project to Cloud" label for "Save Project to Cloud"
(the save modal names and saves — it has no upload) across the settings menu,
sidebar/header buttons, the modal's own h2, and the turn-in toast ("Save
Changes" once cloud-saved is unchanged); renamed the settings-menu "macros"
link to "keyboard shortcuts" so the link matches the modal it opens (the
status-bar "macros"/"keys" dialect rename is queued with B4 — it drags the
keyboard guide's `[[macros]]` chip along).

## feat(chain): row glyphs open the item's settings

The leading glyph in a Chain palette row (counter icon / line swatch) now
SELECTS the row for chaining AND opens the item's details modal (decided
2026-08-15: one click does both) — the same `openCounterLineTypeDetailsModal`
the sidebar edit pens use, so rename/recolor/icon/child counts are reachable
without leaving Chain. Hover shows a gold ring + "Edit …" tooltip; edits
reflect live in the rows, footer, and header chip (updateUI → onChainToolSync);
tool stays CHAIN throughout. Deleting the selected item falls back to the
existing clear-active-id path. chain.spec.js grew the glyph test.

## feat(undo): remaining-count toast + one undo per press

Every successful undo (Ctrl+Z or the bottom-bar button — both funnel through
the one app.js `undo()` wrapper) toasts how many undos remain ("2 undos
left" / "1 undo left" / "0 undos left"; no denominator, 1s duration — decided
2026-08-15), so the 50-step ceiling is never a surprise. `undo-stack.js`'s
undo()/redo() now return true when a snapshot was applied and expose
`undoDepth()`/`redoDepth()` (unit-tested in annotation-model.test.js).
Holding Ctrl+Z no longer machine-guns through the stack: OS auto-repeat
keydowns (`e.repeat`) are ignored — exactly one undo/redo per physical press.
Regression: [undo-toast.spec.js](undo-toast.spec.js) (2 tests).

## feat(chain): draggable palette, closable without leaving the tool, header pair chip

Approved from mockup (2026-08-15). The Chain palette is now DRAGGABLE by its
title bar (pointer-based, viewport-clamped; position persists per device in
localStorage `chainPanelPos`, falling back to the CSS dock when the stored
spot no longer fits) and CLOSABLE without leaving the tool: the title bar ×,
or the ladders — Enter ends the run, then closes the palette; Esc ends the
run, then closes the palette, then exits to Move. While Chain is active with
the palette closed, the `#headerChainPair` chip (counter icon + line swatch,
rendered straight from the ACTIVE selections — no separate memory to drift)
sits right of the Chain button; clicking it reopens the palette, as does
T / the Chain button (which no longer reset the run when already in Chain).
Leaving the tool removes the chip and resets the collapse so every fresh
activation opens the picker. No auto-close on pair-pick (decided — mid-run
pair switching is a real workflow). chain.spec.js grew the ladder + drag +
chip coverage.

## fix(ux): click-through harvest — boot guard, chain + New, verify polish

Four items from the 2026-08-15 production click-through:
1. **Boot sanity guard** — an inline body-tail snippet in app/index.html (a
   deliberate exception to the no-inline rule, like the supabase-enabled
   stamp): if `window.App.state` is missing 1.5s after window load, app.js
   never ran (the field case: a transient CDN 503 on a FIRST visit, before
   the SW exists to backstop) — surface #globalReloadBanner with its own
   Reload wiring instead of a silently dead shell. [boot-guard.spec.js](boot-guard.spec.js).
2. **Chain panel "+ New" rows** — both columns end with a `+ New` action row
   driving the real sidebar create buttons; a fresh project no longer
   dead-ends at "create one in the sidebar" (tool stays CHAIN through the
   create, so the panel re-syncs with the new item selected).
3. **Verify hand-off toast duration** — the mode-teaching toast ("Scale set as
   if printed on … — click both ends…") now shows 8s; at the default it was
   gone before it registered.
4. **Sheet-size reverse lookup on a failed check** — when a corrected preset
   misreads ≥5%, `sheetMatchingCorrection` (geometry.js, node-tested) finds
   the sheet whose correction factor matches the measurement
   (cfNeeded = cfCur × reading/known) and #scaleCheckSheetHint names it —
   resolving the ARCH B/D aspect-twin ambiguity for the rest of the set.

## feat(takeoff): Child counts — derived quantities that ride a parent

Approved from mockup (2026-08-15). Palette items may carry
`childCounts: [{ name, qty, per, ftInterval }]` — words-only quantities
counted automatically with every placement of the parent: `per count`
(counters), `per run`, and `per N ft` (`ceil(rawFeet/N) × zone × qty` PER RUN
— each run rounds up its own supports; zoned feet divided back to raw first).
Never marks on the sheet — derived at tally time by
[features/child-counts.js](features/child-counts.js)'s `getChildCountTotals`
(the room-sizer registration recipe; report.js consumes via guarded App
lookup). Surfaces: Summary sidebar (separate indented rows per parent per
group), report Summary tables, email bullets, and Copy to PipeTooling —
indented rows where the same child name across parents merges into ONE row
under its first parent. Per-ft children on unscaled runs are excluded and
flagged (T1-05), never guessed. Editor: the "Child counts" section in the
Counter/Line Type details modal. The rule rides save/load, export/import,
and the Artboard for free (palettes serialize wholesale). Regression:
[child-counts.spec.js](child-counts.spec.js) (4 tests).

## feat(hotkeys): hold Cmd ~1.5s to peek every hotkey badge

New [features/hotkey-peek.js](features/hotkey-peek.js): holding Meta (Cmd;
Alt as the Windows/Linux alias) for 1.5s without another key reveals a small
gold `<kbd>` badge on every visible control that has a hotkey — an in-the-
moment complement to the Keyboard Map. Badges stamp lazily from
`App.HOTKEYS`, so new hotkeys can never be missing their badge. Release or
focus loss hides them (Cmd+Tab never sends the keyup — blur/visibilitychange
clean up); a second key during the hold cancels the peek (it's a combo).
Regression: [hotkey-peek.spec.js](hotkey-peek.spec.js).

## feat(header): the ⋯ More tools tuck is now unconditional on desktop

Follow-up feedback (2026-08-15) on the priority-reordered toolbar: even when
the window has room for the full row, the low-frequency tool group reads as
clutter. The ⋯ menu (features/header-more.js) now engages UNCONDITIONALLY at
desktop widths — the overflow measure is gone; `updateHeaderMore` simply sets
`body.header-more`, shows the ⋯ (unless every row is viewer-hidden), and runs
the compact-mode measure against the reduced row. Mobile (≤768px) untouched.
[header-more.spec.js](header-more.spec.js) + [header-overflow.spec.js](header-overflow.spec.js)
adapted (wide-width assertions now expect the tuck).

## feat(tools): Chain tool — one click per fixture, connecting runs ride along

Approved from mockup (2026-08-14). New header tool (`TOOL.CHAIN`, hotkey T,
button after Polyline): every canvas click drops a counter marker; from the
second click on, a quick line back to the previous counter rides along in the
SAME undo step — a run of 10 fixtures falls from ~28 clicks to 10. Zero
data-model changes: placements are ORDINARY counter markers + quick lines, so
save/load, reports, exports, zones, and groups work untouched. While active, a
floating two-column palette panel (`#chainPanel`, [features/chain.js](features/chain.js))
offers searchable Counter / Line-type columns; selection writes
`state.activeCounterType` / `state.activeLineTypeId` directly (NOT via the
`setActive*` setters, whose side effect is switching the tool). The anchor is
`state.chainStart` `{x, y, page}` — the page stamp invalidates it across page
switches. Esc ladder: first ends the run (tool stays), second exits to Move.
Scale-gated like Quick Line (button + page-switch gate). The rubber-band
preview honors the 45° snap; grid snap applies to un-anchored placements.
app.js integration: `TOOL.CHAIN` click branch → `App.commitChainPoint`,
`App.onChainToolSync` from `updateUI`, eight publish-only registry deps.
Regression: [chain.spec.js](chain.spec.js) (4 tests).

## feat(header): priority-reordered toolbar + "⋯ More tools" overflow

Field feedback (2026-08-14, approved from mockup): on desktop widths the
tools row overflowed into an invisible-scrollbar scroll, so tail tools
looked cut off — and the tail held Counter / Quick Line / Polyline, the
highest-frequency tools. Two changes ([features/header-more.js](features/header-more.js)):
(1) the toolbar is **priority-reordered** — Set Scale, Move, Counter, Quick
Line, Polyline, Snap-45, Measure, Highlight first, the low-frequency group
last; (2) when the header would overflow (>768px), that group (Polyline and Highlight — moved in on request 2026-08-14 —
Multiply Zone, Scale Zone, Room Sizer, Delete Area, Note, Legend, Grid)
tucks behind
`#headerMoreBtn`'s dropdown — rows show icon + NAME + hotkey, click through
to the real buttons, and forward right-clicks so tool settings still open.
The ⋯ takes the gold `.active` when the current tool lives in the menu
(Legend/Grid are overlay toggles: row-state only). The feature **owns the
one-pass resize pipeline** — measure clean → decide `header-more` → run the
compact-mode measure against the reduced row — because the two independent
measurers otherwise raced (the winning mode depended on the width the
window arrived from); `body.header-collapsed` stays the deeper fallback.
Regression: [header-more.spec.js](header-more.spec.js) + the adapted
[header-overflow.spec.js](header-overflow.spec.js).

## fix(footer): tool hints only ride a one-line status bar

Field feedback (2026-08-14): on desktop widths the status bar flex-wraps, and
a long project name + "Tap start point" shoved the keys/macros/Sign In
actions onto a second row. The tool hint is now measured in and dropped
whenever it would wrap the bar — hints only show when the bar stays on one
line. `updateStatus` runs per mousemove, so the wrap measurement's forced
layout read is cached by (composed text, bar width); coords/totals live in
separate spans and never invalidate the key. (Mobile ≤768px is unaffected —
that regime is nowrap + ellipsis.) Regression:
[footer-hint.spec.js](footer-hint.spec.js) (borderline case: wraps with the
hint, fits without — dropping it is what keeps one line).

## fix(sidebar): filter toasts drop the next-click hint line

Product call (2026-08-14): the "(click again: …)" third line came off every
filter toast — they now read "Filter:" / the landed state, nothing else. The
next state remains discoverable via the button tooltips and the cycle
itself. `showFilterToast` is two-line; the `.toast-hint-line` style is gone.

## feat(sidebar): right-aligned chevrons, funnel filter icon, Lines-toggle toast

Three sidebar refinements (field feedback 2026-08-14): (1) every section's
collapse chevron sits flush right — flexed titles push in-title icons to the
row end, and the Counters / Line Types / Groups chevrons moved after their
"+ Add" buttons so the chevron column aligns across all seven sections (the
Groups chevron, whose section toggles via the title, forwards its click);
(2) the Counters / Line Types usage-filter buttons swap the arrows-inward
glyph for a **funnel** icon (sheet-mode corner dot and project-mode
stacked-sheets glyph unchanged); (3) the two-state Lines "show only on this
sheet" toggle now narrates via the shared three-line toast
(`showFilterToast`, extracted as the core under `showFilterScopeToast`).
Regression: the chevron + Lines-toast tests in
[sidebar-usage-filter.spec.js](sidebar-usage-filter.spec.js).

## feat(sidebar): usage-filter polish harvested from the unlanded bb19fa attempt

A loose-branch audit (2026-08-13) found claude/app-review-docs-bb19fa — a
complete parallel implementation of the usage filter that lost the race to
land — with four design calls worth recovering: (1) the chosen scope now
**persists per device** (`counterSidebarFilterScope` /
`lineTypeSidebarFilterScope` in localStorage; written by the setters — the
one mutation path — read at boot, wiped on sign-out), so a big-palette user
who sets "this project" keeps it across sessions; (2) hint rows state the
REASON ("N not used on this sheet / in this project — show all") instead of
the mechanism; (3) estimator language — "sheet," not "page" — in toasts,
titles, and the settings segments; (4) sheet mode gets a **corner dot** on
the inline button so all three states are visually distinct (off = plain,
sheet = dot, project = stacked-sheets glyph). The zone-scale test scenarios
from the two abandoned worktrees were verified already covered by T1-05's
[line-metrics.test.js](line-metrics.test.js). Regression:
[sidebar-usage-filter.spec.js](sidebar-usage-filter.spec.js) (updated copy +
a new reload-persistence test).

## feat(sidebar): filter cycle clicks narrate their state via a three-line toast

Field feedback (2026-08-13): the inline usage-filter button next to the
Counters / Line Types search boxes cycles three states, but its meaning was
only discoverable via the title attribute. Each cycle click now fires a
three-line toast — "Filter:" / the state just landed on ("counters used on
this page" / "… used anywhere in this project" / "off — showing all
counters") / a dimmed next-click hint ("(click again: …)") — via
`showFilterScopeToast` (app.js), reusing `showToast`'s timer + modal.
`#airboardToastText` was already `pre-line`; the hint line is a
`.toast-hint-line` span (styles.css). Settings-modal segments stay silent
(they're self-labeling). Regression: the toast-narration test in
[sidebar-usage-filter.spec.js](sidebar-usage-filter.spec.js).

## fix(prepare-pdf): rotating a page no longer moves the controls

Field report (Wendi, 2026-08-13): in the Prepare PDF modal, the preview
wrap's height tracked the rendered canvas (min 200 / max 400), so each
portrait↔landscape rotate resized it and shoved the Prev/Next and
Delete/Rotate/Undo rows up and down under the pointer. The wrap is now a
FIXED height (`min(400px, 55vh)`) and the preview canvas contain-fits inside
it (max-width/max-height 100%, auto dims — letterboxed, never scrolled), so
every control stays put across the full rotation cycle. Regression: the
"rotating never moves the controls" test in
[prepare-pdf.spec.js](prepare-pdf.spec.js) (hover-transform-aware — the row's
deliberate `:hover translateY(-1px)` lift is parked off before measuring).

## chore(cloud): scheduled test-account purge — pg_cron + cleanup-test-accounts

The 2026-08-13 storage audit found 610 spec-run leftover projects (~590 MB of
PDFs) under the `test@` / `dev-agent@` accounts; after the one-time cleanup, a
standing guard keeps it from building up again. A daily pg_cron job
(`cleanup-test-accounts-daily`, migration
`20260813233000_cleanup_test_accounts_cron`) invokes the new
`cleanup-test-accounts` Edge Function via pg_net, purging test-account
projects older than 7 days — PDFs first, rows second, so files can never
orphan — plus an unreferenced-file sweep of the two test storage folders. The
request token lives in Vault (`cleanup_test_accounts_token`), not the repo;
unauthorized invocation is harmless by construction (hard-coded accounts +
age cutoff). Full notes: SUPABASE_SETUP.md "Scheduled test-account cleanup".

## fix(palette): same-id palette duplicates — one placed mark counted once per rename (the Wendi FD bug)

Field report 2026-08-13: one floor drain showed as 4 different counters, and
totals/exports counted it 4×. Root cause: Palette Insights' artboard merge
dedupes by NAME but appends with the project's real id — so each RENAME of a
counter ("FD" → "3IN FD" → "3IN FD1" → "3IN FD-1", same id all along)
re-added an artboard entry with that id. `counterMarkers` is keyed by id, so
every rename generation claimed the same placed marks; the corrupted artboard
then seeded every new project (14 duplicated ids on the affected artboard).

Three-part fix: (1) both Palette Insights add paths are id-aware — an
incoming row whose `item_id` already exists is treated as the rename it is
and updated in place, never appended; (2) a pure `dedupePaletteById`
sanitizer (annotation-model.js — first position, last fields) runs at the top
of `reconcileOrphanedCountersAndLineTypes` (every palette intake) and inside
`fetchUserAirboard`/`saveUserAirboard`, so existing corrupted projects and
artboard rows self-heal on open / next save; (3) one-time data repair of the
affected artboard + project rows. Regression: the rename-collision test in
[palette-insights.spec.js](palette-insights.spec.js) + the dedupe/reconcile
units in [annotation-model.test.js](annotation-model.test.js).

## feat(groups): per-project Groups gate — the section earns its sidebar slot

Most users never touch Groups, but every project carried the sidebar section.
Now the Groups UI (sidebar `#groupsSection` + the context-menu Assign-to-Group
entry) shows only when `state.groupsEnabled` is true OR the project already
contains groups. New projects start clean; existing organized projects
auto-show with no migration. Project Settings gains a "Use groups in this
project" toggle (`#settingsUseGroupsBtn`) — locked on while groups exist —
and creating the first group latches the flag true so deleting the last group
cannot hide the section mid-session. `groupsEnabled` rides all three
save-engine payloads, the canvas-JSON export, and is restored by
`hydrateStateFromProjectData`, `applyTakeoffBackupToState`, AND the
copy/load/import intake sites (the five-site duplication the
annotation-model.js comment warns about). Regression:
[groups-per-project.spec.js](groups-per-project.spec.js).

## feat(sidebar): three-scope usage filter — off / this page / this project

The sidebar "show only on current page" toggles grew a third scope. The inline
filter button next to the Counters / Line Types search boxes now cycles
Off → This page → This project (project scope swaps in a stacked-sheets glyph;
the title narrates each state), and the settings-modal toggles became
three-way segments (`#counterShowOnlySegment` / `#lineTypeShowOnlySegment`).
Scope lives in `counterSettings.sidebarFilterScope` /
`lineTypeSettings.sidebarFilterScope` (`'off' | 'page' | 'project'`); the
legacy `showOnly*OnCurrentPage` booleans are kept in sync (`true` only for
`'page'`) so the settings shape is unchanged. Usage checks and the sidebar
badges now count MERGED canvases (all layers — the T1-11 rule; previously
active-canvas-only, so a counter used only on a background layer looked unused
in the sidebar), the active counter/line type is exempt (a just-created type
stays visible before its first mark), and filtered lists append
"N hidden by filter — show all". Regression:
[sidebar-usage-filter.spec.js](sidebar-usage-filter.spec.js).

## fix(counter): Choose-tab count badges summed a dead pre-canvas-layers field (T1-11)

The Counter modal's Choose-tab per-counter badges always read 0: the reduce in
`populateCounterChooseList` (features/counter.js) still read `p.annotations`,
which the canvas-layers migration deletes on every load path. Now sums via
`App.getMergedAnnotationsForPage(p)` — all pages, all canvases (a raw placed-marks
count, like the sidebar; zone multiplication stays Summary-only). Regression:
counter.spec.js badge test seeds marks across two canvases and two pages.

## fix(save): signed-out restore prompt + backup-clobber guard (T1-01)

Journey audit J12/J4 (adversarially reproduced): signed out, closing and
reopening the app lost all work even though a complete on-device backup
(marks + PDF blob) sat in IndexedDB — the "Project from Last Session" offer
was gated inside the signed-in boot branch, and the unconditional 5s interval
overwrote the unrestored `'local'` record ~3.5–5.3s after boot (the silent
palette pre-apply makes the writer guard pass; the clobbering write's newer
`lastModifiedAt` defeats the stale-skip). The same race poisoned the
**signed-in** Keep (its re-read preferred the clobbered record by timestamp:
Keep after 9s restored the PDF with 0 marks), and re-uploading the same PDF
restored palette only (the boot-time `pageCanvases` writes target pages that
don't exist pre-PDF).

Mechanism — key the boot backup aside until Keep/Discard (NOT a pages-empty
write skip, which would drop pre-PDF palette backups): boot moves a promptable
`'local'` record to `TAKEOFF_BACKUP_HELD_ID` (`'local-held'`, same store)
before the pre-apply opens the dangerous window; the pure
`pickBootRestoreCandidate` (save-utils.js) picks between the two records; the
offer is hoisted out of the signed-in gate and carries the held record as
`heldBackup`, which the local Keep uses directly (no poisonable re-read); the
engine holds every backup write while `App.isRestorePromptPending()` (the
prompt is a modal — nothing new can be lost; `backup_clobber_averted` debug
counter in the Save Status log); local Keep lands `isViewer=false` (was
`true` — read-only + backups silenced, live-verified); the held record is
consumed on Keep/Discard and persists across reloads while ignored. Local
sessions restore fully offline (0.26s, zero network in the repro). J4's second
half: `handleFreshUpload` stamps the in-memory `state.localPdfHash` (rides
signed-out backups) and `maybeReapplyLocalBackupMarks` re-applies a
hash-verified same-PDF re-upload's marks (held key first, then `'local'`;
no hash → no apply). Telemetry: `restore_prompt_shown` / `restore_keep`
(migration `20260810120000_user_activity_restore_events.sql`; signed-in only —
`logUserEvent` early-returns without a session). Tests:
restore-last-session.spec.js (boot offer, clobber guard, keep-after-9s
regression, reload persistence, discard, post-Keep lifecycle),
pdf-upload.spec.js (same-/different-PDF re-upload), save-utils.test.js picker
table, constants.test.js key pin; save-engine-smoke.spec.js reads the held key.

## fix(ui): popovers can no longer open off-screen (shared viewport clamp)

Field report: right-clicking a line at the bottom of the screen opened the
canvas context menu half below the viewport — Delete unreachable.
`showContextMenu` placed the menu at the raw pointer coordinates, and most of
the other fixed popovers used hand-rolled partial clamps or hardcoded height
estimates (`menuHeight = 120`). One shared path now: the pure
`clampMenuPosition(left, top, w, h, vw, vh, pad=8)` in geometry.js (unit
tested, including the oversize pin-to-pad case) behind
`placeFixedMenu(el, left, top)` in app.js (published as `App.placeFixedMenu`;
callers show the menu parked at left:-9999px, then place the measured box).
Routed through it: `#contextMenu` (the reported bug — a bottom/right-edge
mark now pulls the menu up/left), the header `#exportDropdownMenu` +
`#showReportMenu`, features/output.js's three menus (Copy-to-/Tooling and
Copy Summary drop-ups + Download, now using measured heights/widths instead
of estimates), and the canvas layers + peek menus (features/canvas-layers.js,
replacing their inline clamps). tool-context-menu keeps its own
flip-then-clamp (already safe). New menu-clamp.spec.js drives a REAL
right-click on a line seeded at the canvas bottom of a short viewport and
asserts the menu's rect sits fully inside the viewport.

## feat(zones): scale-zone label settings (show / size / position, default top-left)

Field report (Grace): a scale zone's label — the fallback `0.23 ft/pt` when the
zone was calibrated by two points and has no preset `scale.label` — rendered
dead-center over the very fixtures the zone exists to count, with no way to
hide, shrink, or move it. Scale zones had **no** label controls: always shown,
always centered, size borrowed from `multiplyZoneSettings.labelSize`.

Now: `state.scaleZoneSettings` `{ showLabelOnZone, labelSize (8–24),
labelPosition }` mirrors the multiply-zone label settings, with the default
position **top-left** (not center) — the zone sits over a detail drawing, so
the resting label must not cover what's being counted. The multiply-zone
corner/center placement math was factored into a shared `zoneLabelLayout`
helper in canvas-draw.js used by both zone kinds (multiply's default stays
center; its pixels are unchanged). New `features/scale-zone-settings.js` +
`#scaleZoneSettingsModal`; the Scale Zone tool button moved out of
tool-context-menu's no-settings toast list and right-click now opens the modal.
The setting rides project save/load, canvas JSON export/import, the IndexedDB
takeoff backup, and the load/copy/intake appliers alongside
`multiplyZoneSettings`. Close re-renders via `renderAnnotations()`
(annotation-only — no PDF re-raster). Tests: four new canvas-draw node tests
(default top-left anchor, hide, size+position, multiply-center unchanged);
`scale-zone-settings.spec.js`; render-pixels seeds the old visual (center,
15px) explicitly so the committed darwin+linux baselines stay valid.

---

## feat(tools): Measure right-click → Set / edit scale

Measuring is where a wrong scale gets noticed, so Measure now carries the
same context action Move gained: `MOVE_ACTIONS` renamed to the shared
`SCALE_EDIT_ACTIONS`, `measureBtn`/`measureBtnSidebar` moved from
`NO_SETTINGS_TOOLS` into `TOOL_CONTEXT` (features/tool-context-menu.js) —
map-only, no new mechanism. The two spec tests that used Measure as the
no-settings example (toast fallback, viewer gate) now use Highlight; the
move routing test loops over both buttons. Docs: ARCHITECTURE rows,
FEATURES/FEATURE-CATALOG, the working-faster guide.

## feat(quick-keys): searchable slot selection

On a real palette (dozens of counters/line types), picking an item in each
Quick Keys slot's native `<select>` was a scroll hunt. `#quickKeysSearch` (a
`.sidebar-search-input` above `#quickKeysList` in app/index.html) now filters
all ten dropdowns live: `optionsHtml(selected, filter)` grew a lowercased
name-substring filter (features/quick-keys.js) that ALWAYS keeps a slot's
currently-bound item listed and selected even when it doesn't match — an
active filter can never blank out or silently rebind a slot. The input sits
outside the re-rendered list so typing keeps focus; it hides in the empty
state and resets on every modal open (a stale filter hiding the palette is
worse than retyping). Spec: quick-keys.spec.js test 8 (filtering, bound-item
survival, focus retention, binding through a filtered list, reset-on-reopen).
Docs: ARCHITECTURE quick-keys rows + the working-faster guide.

## feat(tools): Move right-click → Set / edit scale

Move was in the tool-context-menu's `NO_SETTINGS_TOOLS` toast list, and once a
page's scale was set the only way back to it was the header S tool — easy to
miss. Move now carries a real context action: `MOVE_ACTIONS` = "Set / edit
scale…" → `App.openScaleModal()` (features/scale.js's registered opener;
registry-mediated, read at call time), with an "Open a plan first." toast when
no pages are loaded. `moveBtn`/`moveBtnSidebar` moved from `NO_SETTINGS_TOOLS`
into `TOOL_CONTEXT` in features/tool-context-menu.js — a map-only change, no
new mechanism. Spec: tool-context-menu.spec.js map expectations updated + a
new test (menu label, routes to `#scaleModal`, active tool unchanged by the
right-click). Docs: ARCHITECTURE rows, FEATURES/FEATURE-CATALOG, the
working-faster-with-the-keyboard guide.

## feat(export): pre-export scale check for Copy to /Tooling

Copying a takeoff to PipeTooling with unscaled lines silently exported pixel
lengths ("px of Copper 120") into the bid. Now every `.pipe-tooling-option`
routes through `runToolingExport` (features/output.js):
`collectUnscaledLinePages` walks exactly the pages/annotations the chosen mode
will export and flags pages where a summarized line (known `lineTypeId` — the
`getPipeToolingHasData` rule) has no effective scale — the same
`getEffectiveScaleForLine(...).pixelsPerUnit` test the length math uses for
its px fallback, so scale-zone-scaled lines on unscaled pages pass. **Pages
without line marks never flag** (counter-only pages export untouched). On a
hit, `#toolingScaleCheckModal` lists the flagged page labels with three
actions: Cancel, Export anyway (the button click is the clipboard user
gesture, so the write stays permitted), and Set scale (jumps to the first
flagged page via `fitZoom` and opens the Set Scale modal). The pending export
stash is dropped on ANY hide path via the `App.onToolingScaleCheckHidden`
callback (hideModal special-case + the global Escape branch). New `.secondary`
modal-action button style. Also hardened `getMergedAnnotationsForPage`'s new
`onlyIds` param to be **array-gated**: report.js/export paths pass the
function around as a generic `(page, pageIdx)` getter, so a numeric second
argument must keep meaning "merge everything" (was a latent TypeError on the
All Canvases copy of a 2+-page project; unit-pinned in
annotation-model.test.js). Spec: output.spec.js second test (flag / cancel /
export-anyway px copy / set-scale jump / counter-only pass / zone pass).

## feat(canvas): selective show-canvases peek (right-click chooser)

The show-all-canvases peek can now show a chosen subset of layers instead of
all of them. Left-click on `#showAllCanvasesBtn` keeps its toggle behavior;
**right-click** opens `#canvasPeekMenu` (features/canvas-layers.js) — a
checklist over the page's layers where the active layer is pinned on, other
layers check on/off, and "All canvases" restores the full merge. Selection
lives in the new in-memory `state.peekCanvasIdsByPage` (pageIdx → id array;
empty array = active only, absent = all — unchecking a layer from "all" mode
materializes the rest). `getMergedAnnotationsForPage(page, onlyIds)` grew the
optional filter (annotation-model.js; active canvas always included, so the
no-arg report.js/export paths are untouched). renderCanvasSwitcher prunes ids
whose layer was deleted, dots the button (`.partial`) and titles it "N of M";
flag + selection still auto-clear below two layers. Same contract as the peek
itself: purely visual, viewer-allowed, no dirty, no persistence. Dismissal
follows the tool-context-menu recipe (listeners only while open;
capture-phase Escape swallow). Tests: annotation-model.test.js filter cases +
two new show-all-canvases.spec.js scenarios (subset render via pixel
read-back, prune-on-delete). Docs: AGENTS.md in-memory list, ARCHITECTURE.md
catalog + canvas-layers row, FEATURES/FEATURE-CATALOG, guides/canvas-layers.

## feat(tools): right-click any tool button for its settings

Right-click (desktop/tablet) on a header or sidebar tool button now opens a
small context menu with that tool's actions — the discoverable, uniform
version of what four tools had as hidden one-off handlers:

- **Counter** (+ chip): Counter Settings… / Add counter…; **Quick Line /
  Polyline** (+ chip): Line Type Settings… / Add line type…; **Multiply
  Zone**, **Legend**, **Grid**: their Settings modals. Grid's entry uses a
  new `openGridSettingsModal` (the toggle's enable path extracted) so
  right-click opens settings without flipping the overlay.
- Tools with no settings (Move, Set Scale, Measure, Highlight, Scale Zone,
  Delete Area, Note, Room Sizer, Hide Marks) answer with a toast, so the
  gesture always visibly responds.
- One declarative map in `features/tool-context-menu.js` replaced the nine
  scattered `oncontextmenu` handlers in app.js + counter.js (which reached
  the same modals through the sidebar section-title relay). Dismissal
  listeners attach only while the menu is open; Escape closes only the menu
  (capture-phase, so the global modal-Escape never sees the press);
  ArrowUp/Down cycle items. Viewer-gated. Tooltips advertise the gesture on
  wired tools; the Macros modal carries a static tip. Phone long-press +
  burger-drawer wiring is a deliberate follow-up.

Spec: `tool-context-menu.spec.js` (7 always-run tests).

---

## polish(warmup): the walk is visible, marked-first, and cold flips never show the wrong sheet

Three perception refinements over the full-document warm-up below:

- **Status-bar hint** — `#statusWarmup` shows "Preparing pages N/M" (dim,
  italic, tabular numerals) while the walk runs and disappears at
  completion, making the background work visible and teaching that letting
  a big set sit for ~15s after opening pays off. Driven from the walk's
  `advance()`; reset on document change.
- **Marked pages first** — `runDocWarmupStep` warms the pages carrying the
  user's annotations (`getMarkedPageIndices`, nearest-first) before the
  outward spiral, since those are the pages users actually jump to. Shrinks
  cold-jump exposure for working pages from "wherever the spiral reaches
  them" to the first seconds.
- **Cold-flip white-out** — a flip to a page with NO cached bitmap at any
  rung (and no same-page stale-blit candidate) used to leave the PREVIOUS
  sheet on screen for the whole raster — the wrong drawing for seconds on
  dense pages, reading as "it ignored my click". renderPdf now clears the
  canvas to paper-white immediately (annotations of the new page paint over
  it as the response). Deliberately does not stamp lastPainted*, so the
  restore-retrigger and stale-blit logic still treat the placeholder as
  stale and repaint the moment real pixels arrive. Gated on an actual page
  or rotation change with prior content — first renders and zoom commits
  keep their existing behavior.

All three pinned in [doc-warmup.spec.js](doc-warmup.spec.js) (hint
visible-then-hidden; a seeded far-page marker leads the far-field walk;
raster-delayed cold flip samples paper-white, then crisp ink).

---

## perf(warmup): full-document background warm-up + the idle-prefetch runaway loop

Part 2 of the "last pages are slow to load" fix (part 1 unwedged the render
worker). Even with the worker healthy, the first jump deep into a set was
always a cold multi-second raster — the prefetcher only warmed current±1.

- **Full-document warm-up (prefetch tier 3)** — once the near-field
  candidates (current-page rungs, neighbor pages) are warm, idle time walks
  EVERY page outward from the current one at its rung-snapped fit zoom
  through the same one-at-a-time prefetch slot (kind 'prefetch' → the worker
  pool's background seat). Rung-snapped captures flow through the existing
  persist path into the IndexedDB pyramid, so the walk warms this session
  AND every later reopen; pages whose fit rung is already persisted cost one
  IDB index read, no raster. Same interaction discipline (cancel on any
  render/wheel/touch/pointer, `pdfPrefetchGen` invalidates in-flight async
  continuations), 250ms cadence, skipped on low-memory devices. The 39-page
  field set warms completely in ~14s of idle.
- **Idle-prefetch runaway loop (pre-existing, exposed by the walk)** — a
  capture's pyramid derives can evict a sibling candidate from the
  slot-capped bitmap cache; the chain then re-rasters the evicted key, whose
  derives evict another — observed at ~12 rasters/s FOREVER on dense sheets,
  plus a duplicate IDB webp write per re-capture (366 writes in 40s), hidden
  because any interaction cancels the chain. Fixed: one attempt per key per
  chain (`pdfPrefetchAttempted`, cleared on cancel) + a session persist
  dedupe (`zoomRungsPersistedKeys`). After the fix the same idle window does
  41 rasters / 40 persists and goes quiet.
- **Page-count-aware pyramid cap** — `idbZoomRungsPut` takes an optional
  per-doc cap; app.js passes max(24, pages×2) so a 39-page walk no longer
  self-evicts (the ~96MB global byte budget stays the true bound).
- **Restore-retrigger** — a deep jump's cold raster used to race the lazy
  IDB restore and win: the user stared at the PREVIOUS sheet while the dense
  page rastered, with the restored bitmap arriving unused. When a restore
  lands for the page the user is on and the canvas hasn't painted it yet,
  renderPdf re-enters once and the ladder serves the restored rung
  immediately. Measured on the field set: jump to page 36 swaps content in
  ~22ms (was: full raster time).

New regression: [doc-warmup.spec.js](doc-warmup.spec.js); idb.test.js covers
the cap override. The full render-path battery (19 tests) passes.

---

## feat(telemetry): render-worker fallback mirrors to the admin activity feed

The field lesson from the worker-scope fixes below: `render_worker_fallback`
only landed in the LOCAL Save Status log, so a session (or a whole deploy)
silently degraded to main-thread rasters and nobody saw it — it surfaced as
"the app feels slow" weeks later. render-service gains an optional
`deps.onFallback(reason)` hook, fired once per session at the moment the
worker is disabled; app.js mirrors it into the admin activity feed
(`logUserEvent('render_worker_fallback', projectId, {message, source})`,
the reportClientError pattern), self-gated on Supabase + session. Node
coverage: a stubbed-Worker adoption failure fires the hook exactly once
with the reason, the session lands `failed`, and the raster still completes
on main.

---

## fix(render-worker): dense CAD sheets crashed the worker (patterns) and garbled text (fonts)

Field case: a 39-page underground-plumbing set (7 MB, pages up to ~350k pdf.js
operators) always ran main-thread — `render_worker_fallback` with
`raster: Cannot read properties of undefined (reading 'createElement')` on the
FIRST raster, so every dense sheet blocked the UI for the whole session and the
"last pages are slow to load" complaint came straight back. Two worker-scope
holes in pdf.js 3.11's defaults, both invisible on simple test PDFs because the
failing paths are lazy:

- **Aux-canvas factory** — `DefaultCanvasFactory` in a non-Node scope is
  `DOMCanvasFactory` (`document.createElement('canvas')`), consulted only when
  a page needs an auxiliary canvas: tiling patterns, transparency groups, soft
  masks — i.e. every hatched/shaded CAD sheet. The worker now passes a
  duck-typed OffscreenCanvas factory (+ a no-op filterFactory) to
  `getDocument`, so the raster that used to wedge the session into permanent
  main fallback just renders.
- **Embedded fonts** — FontLoader wants `ownerDocument.fonts` (a FontFaceSet);
  without one it falls into a CSS-rule path that also needs the DOM and every
  glyph rasters as a solid black box (caught by pixel-diffing worker vs main
  output — ink delta 1.26% broken, 0.000% fixed). Worker scopes have their own
  `self.fonts`, handed over via an `ownerDocument: {fonts: self.fonts}` shim;
  engines without it get `disableFontFace` (glyph-outline drawing) instead.
- **useWorkerFetch (third hole, exposed by the substitute-font merge)** — with
  `cMapUrl`/`standardFontDataUrl` set but `useWorkerFetch` unset, pdf.js
  computes the default by touching `document.baseURI` — a ReferenceError at
  DOC LOAD in worker scope, so the fix/pdfjs-font-fallback merge silently
  broke worker adoption for **every** PDF (caught when this branch's new
  worker specs went red after syncing). The worker now passes
  `useWorkerFetch: true` explicitly — also the right value: the nested pdf.js
  worker fetches both URLs itself.

Verified against the field PDF: worker `ready`, 93/93 rasters in the worker,
zero fallbacks, main-thread page-switch stall 20-30ms → 5-9ms, and the
worker/main renders pixel-equivalent (0.013% of channels, max delta 16 — AA
jitter). [render-worker.spec.js](render-worker.spec.js) gained both guards: a
spec-crafted tiling-pattern PDF must worker-raster with zero fallbacks, and
the embedded-font sample plan must render ink-identical in both modes (both
fail against the old worker).

---

## ops(supabase): advisor backlog cleared — initplan rewrites + anon revoke

The two deferred advisor items from the 2026-07-24 scan, both user-approved,
applied to production via MCP and verified by re-running the advisors:

- **auth_rls_initplan (9 WARNs → 0)** — migration
  `20260724210000_rls_initplan_select_auth_uid`: every `auth.uid()` in the nine
  flagged policies wrapped as `(select auth.uid())` so Postgres evaluates it
  once per query instead of per row. Expressions are the pg_policies
  definitions captured verbatim before the rewrite; behavior-identical.
- **anon_security_definer_function_executable (24 WARNs → 0)** — after the
  audit proved zero anon callers (rpcSupabase requires a session token; the
  view-link path uses Edge Functions + signed URLs only; Edge Functions call
  no public RPCs), TWO migrations: `20260724220000` revoked the direct anon
  grants — and the advisor re-scan caught that `anon` STILL had execute via
  the default `PUBLIC` grant (`=X/postgres` in proacl), which role membership
  inherits. `20260724221000` revokes PUBLIC; authenticated + service_role keep
  their explicit grants (verified in every ACL first), and ground truth
  confirmed after: `has_function_privilege('anon', …)` false on all 24,
  authenticated intact on all 23 it should keep (`handle_new_user`, a trigger
  fn, lost authenticated too — nothing should reach it via the API).
  **Lesson for future RPCs: CREATE FUNCTION grants PUBLIC execute by default —
  every new RPC needs the same PUBLIC revoke.**

Remaining advisor findings are INFO-level (unindexed audit-column FKs, two
unused indexes) plus two dashboard toggles only an owner can click: leaked-
password protection (Auth → HIBP) and percentage-based Auth DB connections.
Field smoke still owed: one prod view-link click to confirm the anon path.

---

## feat(telemetry): field errors mirror to the admin activity feed

Phase 2 of the client-error hooks: `reportClientError` now also fires
`logUserEvent(kind, projectId, {message, source})`, so crashes land in the
admin User Activity view PROACTIVELY instead of waiting for a user to export
their Save Status envelope. Signed-in only (logUserEvent gates itself), message
+ source only (the stack stays client-side in the envelope), and the existing
dedupe + 10/session cap bound the volume before it ever reaches the wire.

---

## feat(artboard): uploaded custom icons follow the account

Both artboard apply-sites have checked `airboard.customIconPaths` since the
artboard shipped — but `fetchUserAirboard` never selected such a column, so the
check was dead code and a user moving devices got their palette back without
their uploaded icon library (placed counters still rendered — the SVG path
travels with the counter — but the picker lost the icons). New
`user_airboard.custom_icon_paths` column (additive migration 20260724200000,
user-approved), `saveUserAirboard` now sends `getUserCustomIcons()`, and the
long-dead apply branches went live untouched. Clear artboard deliberately does
NOT clear the icon library (it's a library, not palette state).
my-settings.spec.js gains a stubbed-fetch test driving the real Load handler
end-to-end: custom icons land in `getUserCustomIcons()`, bindings seed via the
replace path.

---

## test(render-pixels): linux baselines — the draw core is now pixel-guarded in CI

render-pixels (the maxDiffPixels: 0 safety net over canvas-draw.js, the ONE
painter every mark renders through) was excluded from CI because its baselines
were darwin-rasterized. Linux twins are now committed
(`*-chromium-linux.png`), generated inside the official
mcr.microsoft.com/playwright linux/amd64 image against this repo, and verified
bit-exact on a second cold container run before committing. The CI testIgnore
is gone — the draw core is pixel-guarded on every push, not just on a Mac.
Regeneration recipe lives in playwright.config.js next to the (now empty)
ignore. Playwright picks the platform suffix automatically, so local Mac runs
keep using the darwin files untouched.

---

## ops(supabase): first production advisor scan — 2 fixed, the rest triaged

First security + performance advisor pass over the production project
(hrqxvfydmvtvwhvefmqc), 2026-07-24. No ERROR-level findings. Applied now
(migration `20260724190000_pin_trigger_function_search_paths`): the two
`function_search_path_mutable` warnings — `set_projects_updated_at` and
`auto_checkout_on_project_insert` pinned to an empty search_path (both bodies
touch only NEW.*/now(), so it's config-only, provably safe).

Triaged, deliberately NOT auto-fixed:

- **24 RPCs executable by `anon` as SECURITY DEFINER** (the advisor's top
  class). Every RPC guards internally on auth.uid()/is_admin, so anon calls
  return nothing — but revoking anon EXECUTE would be real defense-in-depth.
  Blocked on an audit first: view-link viewers ARE anon, and any RPC the
  viewer path calls client-side (touch_presence? log_user_event?) would 403
  after a blanket revoke. Action: grep the viewer code paths, then revoke
  anon on everything not on that list. `handle_new_user` (a trigger fn)
  should likely leave the exposed API schema entirely.
- **The matching `authenticated` SECURITY DEFINER warnings are by design** —
  RPCs are the API for signed-in users and gate by role internally.
- **9 `auth_rls_initplan` WARNs** (policies re-evaluating auth.uid() per
  row): mechanical `(select auth.uid())` rewrites across profiles / projects /
  project_shares / user_airboard / user_activity / view_link_access_log —
  worth one focused migration when tables grow; today's row counts make it
  low urgency.
- **Dashboard toggles (can't be done via SQL)**: enable leaked-password
  protection (Auth → HaveIBeenPwned check) and switch Auth's DB connection
  strategy from absolute (10) to percentage.
- **INFO-level**: 5 unindexed FKs on audit-ish columns and 2 never-used
  indexes — noted, not worth churn yet.

---

## refactor(hotkeys): one table drives the handler, the Macros list, and the Map

The keydown handler, the Macros shortcut table, and (transitively) the Keyboard
Map were three hand-maintained surfaces — which is how the V (Room Sizer)
hotkey shipped live with no documentation row for weeks. Now `HOTKEYS` in
constants.js is the single source: the app.js handler EXECUTES it (non-bespoke
entries click their `btnId` or run a named closure action from
`HOTKEY_RUNNERS`; viewer gating rides the entry), and the new
scripts/build-macros.js RENDERS it into the Macros table between generated
markers in app/index.html — with `{btn}` row icons extracted live from the
actual toolbar elements, so they can't diverge either. `npm run check` gains
`build:macros -- --check`. The Keyboard Map keeps deriving from the generated
table, so all three surfaces chain off one source.

Bespoke rows (arrows, undo/redo, Escape, Space, Enter, Shift+Q, the Scale Zone
note) stay documentation-only — their handling is structurally custom and
remains hand-written. Guards: constants.test.js checks the table shape (unique
keys, exactly one of btnId/runner); new hotkeys.spec.js asserts every runnable
entry resolves to a real runner or element (both directions), smoke-drives
d/m/j through the real keydown path, proves viewer gating (h no-ops, d works),
and confirms every runnable key lights on the Keyboard Map end-to-end.

---

## feat(telemetry): field errors ride the Save Status envelope

Save/sync failures were richly instrumented, but a plain JS exception in the
field — a handler throwing on one odd project — vanished silently, so "it just
stopped working" reports arrived with nothing. window.onerror +
unhandledrejection now feed `pushSaveEvent` (`client_error` /
`client_unhandled_rejection`, stack + source in the detail), landing in the
saveStatusLog and exporting with the envelope — the diagnostic path users
already know. Deduped by kind+message and capped at 10/session so a
throw-in-a-loop can't flood the log; resource-load errors are skipped (no
.error — the SW/network layer owns those); nothing is rethrown or
preventDefault-ed, so the console story is unchanged. Inherits pushSaveEvent's
disabled-Supabase drop, which is the right gate: cloud users are who export
envelopes. New `[sync] Field-error telemetry` section marker; test appended to
save-status.spec.js (real throw + real rejection, dedupe asserted, stack in the
envelope).

---

## feat(quick-keys): bindings ride the Artboard — the muscle-memory hole closed

Honest correction of the original ship: bindings were per-project and Save/Load
Artboard did NOT carry them, so every new bid started with an empty number row
even though the artboard restores the very ids the bindings point at. Now
`user_airboard.number_key_bindings` (jsonb, additive migration
20260724180000, applied to production via MCP with user approval) stores the
layout with the palette.

Lifecycle rules live in ONE place (features/quick-keys.js) so they can't drift:

- `seedQuickKeysFromArtboard(raw, {replace})` — sign-in auto-restore seeds
  FILL-IF-EMPTY (never stomps an active layout, order-independent vs project
  restore); My Settings → Load from Cloud passes replace:true (the user just
  confirmed "replace"). Sanitizes slots/kinds/ids on the way in.
- `applyProjectQuickKeys(incoming)` — all three project intakes (cloud load,
  PDF-intake restore, canvas-JSON import) funnel here: a payload WITH bindings
  replaces and clears the artboard-lineage flag; a payload WITHOUT keeps an
  artboard-seeded layout but drops a previous project's, so dead ids never leak
  between unrelated projects.
- `resetLocalSessionState` stays an UNCONDITIONAL wipe — it doubles as the
  sign-out hygiene path, and bindings must never survive to the next user on a
  shared machine. The seed survives the normal new-bid flow (sign in → upload),
  which never passes through reset.

Artboard export includes the bindings; Clear artboard clears them (the palette
they point at is gone). quick-keys.spec.js gains the lifecycle test: seed rules,
project replace-or-keep, and a real canvas-JSON import keeping a seeded layout.

---

## chore(filemap): the Large-file map line counts are now generated

The decomposition table's caption asked humans to "refresh when they drift" —
and they didn't (it sat three days stale carrying a 689-line undercount for
app.js). New [scripts/build-filemap.js](scripts/build-filemap.js), the same
committed-artifact-generator pattern as build-toc/build-sw: it restamps each
row's Lines cell, the `features/*.js (NN files) | total` row, and the caption
date (only when a count actually moved, so --check is deterministic across
days). `npm run check` now includes `build:filemap -- --check`, so a stale
table fails CI instead of waiting for someone to notice. Ownership split on
purpose: the generator owns the numbers; humans own which files are listed and
every Status / verdict — add a row by hand and its count stays fresh from then
on.

---

## refactor(lines-list): first split out of the UI Render Functions region

The decomposition table has named UI Render Functions (~1,065 lines) as the
next candidate since the canvas-draw extraction: "the list renderers are
separable per-list as feature files; updateUI itself stays core." This starts
it with the cleanest unit — `renderLinesList` (123 lines, six inbound call
sites, zero closure state) → [features/lines-list.js](features/lines-list.js).

- **The hot-path seam**: updateUI (which can run at boot, before feature files
  load) reaches it defensively — `App.renderLinesList && App.renderLinesList()`
  — the burger-menu pattern; an empty Lines section for that instant is
  harmless since no project is open yet. The search-input and show-only
  handlers call it plainly (user-action time).
- Five new publish-only deps: `formatArea` + `polygonArea` (geometry.js
  globals, lint-invisible to the features eslint group, routed through the
  registry like pilot #13's `ptDist`), `pickScaleForLineType`,
  `getLineRealWorldLengthFeet`, `onDoubleTapOrDblClick`.
- New [lines-list.spec.js](lines-list.spec.js) drives the moved surface through
  the REAL updateUI path: grouping/totals (`3 lines · 25.00 ft`),
  expand/collapse persistence, search, select-and-jump, deselect.

app.js 7888 → 7779; the region drops to ~940 with the remaining renderers
each separable by the same recipe.

---

## feat(quick-keys): mobile path via Project Settings + status-bar visibility fix

The status-bar `keys` link is desktop-only (digits need a keyboard), which left
tablets/phones with no way to reach the binding modal at all. A **quick keys**
row now sits in the Project Settings links row next to `macros` — the settings
modal is reachable everywhere (sidebar logo on mobile) — bound in
features/quick-keys.js, mirroring the settingsMacros handler (close settings,
open ours).

Fixing that surfaced a shipped regression worth naming: the `.has-icon` class
(status-bar icon links) carried a `display`, which out-cascaded the
`.status-bar-desktop-only { display:none }` hide — equal specificity, later in
the file — so `keys` and `macros` were **leaking into the cramped mobile status
bar**, and the un-ID'd separator between them never showed on desktop at all
(the house pattern re-shows these BY ID in the 769px media query, and it had no
id). Fixed properly: `.has-icon` no longer sets display, the separator got
`#statusBarQuickKeysSep`, and all three entries are re-shown by ID at 769px+
(the two links as `inline-flex` so the icon alignment holds). A new mobile
spec pins both the hide and the settings-modal path so this can't regress
silently again.

---

## feat(quick-keys): bound rows wear their digit in the sidebar

A user had to remember what they bound — the bindings lived only in the modal.
Now a counter / line type with a Quick Key shows a small keycap badge next to
its name in the sidebar (accent digit on a dark chip, echoing the Keyboard
Map's lit-key look so the two surfaces read as one feature), so the bindings
teach themselves during normal work.

`quickKeyBadgeHtml(kind, id)` in app.js's `renderCountersList` /
`renderLineTypesList` reads the feature-registered reverse lookup
`App.getQuickKeySlotFor(kind, id)` **deferred** (a boot-time render before
quick-keys.js loads just shows no badges; bindings only arrive with a project
load anyway, and every later updateUI re-renders). The modal's bind/clear
handlers call `refreshSidebarBadges()` so the sidebar tracks changes live while
the modal is open. quick-keys.spec.js gains a badge test (digit/row pairing,
unbound rows bare, live refresh on unbind).

---

## feat(undo): history deepened 5 → 50

`UNDO_STACK_SIZE` (constants.js) was set to 5 back when every snapshot
deep-copied the whole project. The perf-endgame work moved the high-frequency
sites (counter/line/polyline/highlight placement, drops, notes) to
**page-scoped** snapshots — O(current page), not O(project) — so the old cost
rationale no longer held, while estimators doing rapid placement burned through
5 steps in seconds. Now 50. The rare cross-page cascades (counter/line-type/
group delete) still push full snapshots, but a heavy stack would need 50 of
those *in a row*, which no real session produces. No test edits needed — the
cap tests in annotation-model.test.js and constants.test.js derive from the
symbol, which is exactly why the cap lives in constants.js.

---

## polish(status-bar): icon for "macros", optical alignment for both

Gave the status-bar `macros` link a keyboard glyph to match the keypad on `keys`
(keyboard = all shortcuts, keypad = the number row — the See Keyboard button uses
the same keyboard icon, so the three read as a set). Folded the shared layout into
a `.has-icon` class.

The vertical nudge that levels the glyph with the lowercase text turned out to be
**per glyph**, not shared: the keypad's ink sits low in its 640-box (lift 1px),
while the keyboard's ink is centred yet renders high against the text (drop 2px).
A single value couldn't level both, so each icon carries its own `top`. Values
were dialled in by magnifying the status bar and matching each icon's rendered
ink-centre to the text — the programmatic metric jittered ±2px on text line-box
rounding, so the eye was the tiebreaker. Desktop-only surface; no test change.

---

## feat(quick-keys): the number row binds to counters and line types

Placing a mark was already one click; picking WHAT to place was the slow part of a
takeoff — a mouse trip to the sidebar and a visual scan, repeated all day. The
number row (`1`–`9`, `0`) now binds to counters and line types, so switching is a
keystroke. Bound from a new status-bar `keys` link (keypad icon, left of
`macros`) → `#quickKeysModal`, ten slot rows with a picker and a clear button.

- **The number row was completely free** — no digit was bound anywhere in the
  hotkey handler, and the existing `e.target.matches('input, textarea,
  [contenteditable]')` guard already meant typing digits into a name field
  couldn't fire them. Nothing to design around.
- **ONE SELECTION PATH.** The sidebar row-click bodies were extracted into
  `setActiveCounterType(id)` / `setActiveLineType(id)` (app.js), and **both** the
  row click and the number key now call them. A number key does not implement its
  own activation, so toggle-off semantics (second press deselects), the tool
  switch, and the pages-section collapse cannot drift between the two entry
  points. The spec asserts this directly: pressing `1` and calling
  `App.setActiveCounterType('c1')` must leave identical state.
- **Per-project bindings that still follow the user.** `state.numberKeyBindings`
  maps slot → `{kind, id}`. Ids come from `uid()` and are project-scoped, so the
  data is per-project and rides save/load, export/import, and the IDB takeoff
  backup. But Save/Load Artboard stores `state.counters` / `state.lineTypes`
  wholesale — **ids included** — so an artboard restore lands the same ids the
  bindings point at, and a standard palette carries its key layout between bids.
- A binding whose target was deleted resolves **stale**: it toasts rather than
  silently doing nothing (the real "why didn't that work" moment), renders a
  `deleted` marker in the modal, and **keeps the id** so re-creating or
  re-importing that item revives the slot.
- Modifier+digit falls through untouched, so `Ctrl`/`Cmd`+`1` browser tab
  switching still works. Viewer-gated inside `triggerQuickKey`.
- **Self-documenting via the Keyboard Map**: bound digits light up with their
  names (`1 — Floor Drain`). This made Quick Keys the board's **second, dynamic
  source** — `collectMacroKeys` merges `App.getQuickKeyLabels()` in on top of the
  static Macros table, and the inline board rebuilds whenever Macros opens, since
  bindings arrive with a project load long after the feature file ran.

New regression: [quick-keys.spec.js](quick-keys.spec.js) (7 tests) — the modal
binding path, the key switching + toggling off, the equivalence test above, the
keystrokes it must NOT steal, stale-binding reporting, clear-slot, import
survival, and the Keyboard Map pickup.

---

## feat(keyboard-map): inline on desktop, button-and-modal on mobile

The board was good enough to stop being a click away. On **desktop** it now
renders **inline at the top of the Macros modal** — open Macros and it is just
there, above the shortcut list. **Mobile keeps the previous behavior** (the "See
Keyboard" button opening `#keyboardMapModal`), because a 560px board does not fit
a phone-width card.

- **Two hosts, one code path.** A "host" is any element wrapping a `.kb-board`
  and a `.kb-caption`; `buildBoard` / `setCaption` / `wireBoardInteraction` /
  `renderInto` all take one, so neither surface is special-cased. CSS picks which
  host is visible at the 769px breakpoint; **both are built regardless**, so
  resizing across the breakpoint (or rotating a tablet) needs no rebuild and no
  resize listener.
- The inline host is built **once at feature load** — the Macros table it derives
  from is static markup and this script is the last one in the body, so the
  derivation is already valid. The modal host still renders per open.
- **Two layout constraints had to be solved, not just styled around:**
  `.macros-modal-card` was 400px wide against a 560px board, so on desktop it
  widens to 660px; and modal cards only get a `max-height` inside the
  `max-width: 768px` media query, meaning a taller card on desktop would have run
  off the bottom of the screen with no way to scroll to the rest of the list. The
  card is now a flex column capped at 88vh with the **body** flexing, so the
  shortcut table scrolls underneath a pinned keyboard.
- Mobile is the CSS *default* and desktop the `@media (min-width: 769px)`
  enhancement, so the phone path is the one that cannot regress by omission.

[keyboard-map.spec.js](keyboard-map.spec.js) split by breakpoint: a desktop
describe (inline board present on Macros-open with **no second click**, button and
modal both out of the way, plus a layout-contract test — card within the viewport,
the body rather than the card scrolling, board above the body) and a mobile
describe at 375×812 (inverted visibility, button → modal, horizontal containment,
Escape ordering, close button). Both run the derivation guard against their own
host.

---

## feat(snap): J now snaps to 45° diagonals, not just horizontal/vertical

Field request (Robert): the `J` snap only produced horizontal and vertical
lines, but 45° fittings are stock plumbing hardware (there is a `45-elbow.svg`
in `my-counters/`), so any angled run had to be drawn freehand. `J` now
constrains to the nearest of **8** rays — 0/45/90/135/180/225/270/315.

- All five call sites (quick-line preview + commit, polyline preview + commit,
  and the mobile aim loupe by way of those commits) already funneled through the
  one pure primitive, so this is a single-function change. `geometry.js`'s
  `snapToHorizontalOrVertical` became **`snapLineToAngle(x1, y1, x2, y2,
  stepDeg)`** — the old name would have been a lie once diagonals landed, and
  the repo renames things when their content drifts. `stepDeg` defaults to 45
  and still accepts **90 for the original H/V-only behavior**, so reverting is
  one argument.
- The end point is still the **orthogonal projection** of the pointer onto the
  chosen ray (what the H/V version did by keeping `x2` or `y2`), so the line
  keeps tracking how far along the ray you've dragged.
- The 8 rays are **integer** direction vectors `(1,0) (1,1) (0,1) (-1,1) …` with
  the projection taken as `(d·v)/|v|²`, not unit vectors via cos/sin. That keeps
  the arithmetic exact: `cos(90°)` is `6.1e-17` and `√½·√½` is
  `0.5000000000000001`, either of which would bake ~1e-15 offsets into stored
  PDF-space annotations and leave "vertical" lines a hair off vertical. Axis
  snaps are bit-identical to the old implementation; an exact 45° drag returns
  exactly `(t, t)`.
- Labels updated (header button, Line Type Settings row + tooltip, and the
  Macros row → "Toggle snap to 45° angles"). The **persisted setting key stays
  `snapToHorizontalVertical`** — renaming it would orphan every saved
  `lineTypeSettings` in localStorage and in per-project data.
- The Macros-row edit flowed into the Keyboard Map caption for free, since that
  board derives its captions from the table — the first payoff of that design.

[geometry.test.js](geometry.test.js) gains 5 tests: the original two H/V cases
kept verbatim (proving the axes didn't move), all four diagonals, the 22.5°
decision boundary, `stepDeg: 90` parity, and the zero-length no-op.

---

## feat(keyboard-map): "See Keyboard" — a visual map of the mapped keys

The Macros modal is a good reference but a poor *overview*: to learn what is
mapped you have to read 25 rows. A **See Keyboard** button now sits pinned above
that modal's scrolling body and opens `#keyboardMapModal`
([features/keyboard-map.js](features/keyboard-map.js)) — a 65%-ANSI keyboard
silhouette where every key carrying a shortcut lights accent-yellow against the
near-black board, modifiers (Shift/Ctrl/Cmd) get a softer outlined variant so the
action keys are what the eye lands on, and everything unmapped stays grey.
Hovering (mouse only — a touch "hover" fires and vanishes), tapping, or focusing
a lit key names its action in the caption below; a key used by two shortcuts
lists both (`R — Rotate page · Refresh`).

- **The lit keys are DERIVED from the Macros table, not hand-declared.**
  `collectMacroKeys()` walks `#macrosModal .macros-table` at open time — each
  row's `<kbd>` cells give the keys, the last cell gives the action — so adding
  a shortcut row lights its key automatically and the list and the board cannot
  drift. Rows with no `<kbd>` (section headers, the `<th>` row, the em-dash
  Scale Zone row) drop out on their own. Same instinct as
  [features/burger-menu.js](features/burger-menu.js) rebuilding its rows from
  the currently-visible header controls.
- **Found while building it: the Macros table was missing `V` (Room Sizer).**
  The hotkey has been live since Room Sizer shipped (`k === 'v'` → `#roomBtn`)
  but never got a table row — the same class of gap as the room-box Delete bug
  below. Row added, so both the list and the board now show it.
- Geometry: 5 rows, each 15 width units over a 60-column grid, so the
  1.25/1.5/1.75/2.25-unit keys land on exact column boundaries and the rows
  align like a real board. The board is deliberately a superset of the mapped
  keys (it has to read as a keyboard); `.kb-board-wrap` scrolls it horizontally
  on a phone without the page body overflowing.
- A **zero-new-dep** split — `App.showModal` / `App.hideModal` were the only
  deps, both already published (like pilots #5 and #7). Registers
  `App.openKeyboardMapModal`; the opener and close bindings are element-bound at
  load. The app.js Escape branch checks `keyboardMapModal` **before**
  `macrosModal`, so one Escape closes the board and leaves the shortcut list up
  behind it.

New regression: [keyboard-map.spec.js](keyboard-map.spec.js) — the load-bearing
test is the derivation guard (every `<kbd>` in the table must resolve to a lit
board key), plus the real open path, the modifier/unmapped styling split, the
hover caption, Escape ordering, and the phone-viewport containment.

---

## fix(room-sizer): context-menu Delete now removes room boxes

Field report (Wendi): right-clicking a placed room box showed the Delete
item, but clicking it did nothing. The `ctxDelete` switch handled markers,
lines, polylines, highlights, both zones, and notes — but never gained a
`roomBox` branch when the Room Sizer shipped, so the menu closed and the box
survived. Branch added (splices `ann.roomBoxes[t.index]`); the handler also
moved to the page-scoped undo snapshot (every branch mutates only the
current page's active canvas). Regression appended to
[room-sizer.spec.js](room-sizer.spec.js) (seed box → right-click → target
type `roomBox` → Delete actually deletes, menu closes, no errors).

---

## perf(endgame): tile grid, worker pool, persistent pyramid, page-scoped undo

The four remaining roadmap items, together:

- **Deep-zoom viewport TILE GRID** — the idle deep-zoom sharpening (the old
  single-window crop tile) is now a compositor: fixed 512-css-px tiles
  rastered at full dpr via the render service/worker into a budget-capped
  cache (32M px high-mem / 12M px otherwise; farthest-from-center eviction),
  composited onto #cropCanvas over the visible window. Panning re-composites
  cached tiles instantly and rasters only newly exposed cells, center-out —
  map-app behavior, raster cost bounded at ~one screen regardless of zoom or
  sheet density. The commit-mode window-first tile is unchanged. New:
  [tile-grid.spec.js](tile-grid.spec.js); the existing crop-tile.spec passes
  unchanged against the compositor.
- **Render worker POOL** — slot 0 stays interactive (full-page + tiles);
  slot 1 (deviceMemory ≥ 8, docs ≤ 25MB — it holds another copy of the doc)
  takes background prefetches so warm-up never queues behind an interactive
  raster. Per-slot stats in the service snapshot; any slot failure falls the
  whole pool back to main-thread for the session.
- **Persistent pyramid** — rastered RUNG bitmaps persist to IndexedDB (store
  `zoom_rungs`, DB v7; webp q0.85, keyed docHash|page|rotation|rung|effDpr;
  caps 24/doc + ~96MB global, oldest-first eviction; node-tested). The doc
  hash comes from `renderService.ensureDocHash` (guarded transport getData +
  crypto.subtle — works with or without the worker). Restore is lazy per
  (doc, page) on first render; restored entries feed the same cache and the
  downsample pyramid re-derives below them — daily projects reopen with
  yesterday's ladder warm. `persisted`/`restored` counters in the cache
  stats. New: [pyramid-persist.spec.js](pyramid-persist.spec.js) (persists,
  then restores across a real page reload).
- **Page-scoped undo snapshots** — `pushUndoSnapshotPage(pageIdx)` in the
  undo model deep-copies ONE page + the small palettes instead of every page
  (O(current page), not O(project)); undo/redo capture their inverse at the
  same scope, so redo entries stay small too. The high-frequency page-local
  sites (counter/line/polyline/highlight placement incl. touch, measure,
  drops, notes, line properties) switched over; cross-page cascades
  (counter/line-type delete, group delete) deliberately keep full snapshots.
  Unit-tested (page-scope isolation, interleaving with full snapshots,
  scale/rotation/palette restore).

---

## perf(pyramid): downsample pyramid + prefetch immediacy/momentum

"See more pixels more quickly" — attack the remaining cost, COLD rasters:

- **Downsample pyramid** — a full-page bitmap rastered at zoom Z produces
  every rung below it (down to ~0.55×Z) by GPU downscale: after any cache
  capture, the rungs below derive automatically (one drawImage per
  macrotask, high-quality smoothing, always from the ORIGINAL source — never
  derived-from-derived; generation-guarded; `derived` flag + stats counter).
  One pdf.js operator-list walk now warms the whole ladder downward, so
  zooming back OUT is warm everywhere she's ever zoomed in, and the idle
  prefetcher spends real rasters only on UP-rungs.
- **Prefetch immediacy** — idle delay 250ms → 50ms (the worker made the
  main-thread cost a postMessage; interaction listeners still cancel
  instantly). The next rung starts rastering before the finger leaves the
  wheel.
- **Momentum bias** — rung candidates warm the direction the user has been
  zooming first (wheel + pinch tracked; down-rungs usually arrive free via
  the pyramid anyway).
- Spec-infra note: page-switch-cache / rung-prefetch now count VISIBLE-PATH
  ('full') rasters only — background prefetches legitimately fire within
  their old measurement windows at the 50ms delay.

New regression: [pyramid.spec.js](pyramid.spec.js) (lower rungs appear
derived with zero rasters, zoom-out commits blit from them with the miss
stat frozen, derived bases carry ink).

---

## perf(instant): rung-riding, deeper warm-up, debounced click tail, latency telemetry

For the zoom-several-times-a-second + rapid-placement workflow ("the feeling
of loading really slows her down"):

- **Rung-riding** — every wheel/pinch/rail frame (via syncZoomIndicators)
  checks whether the continuous preview zoom is nearer a DIFFERENT cached
  rung and blit-swaps the base MID-GESTURE (strictly blit-only; uncached
  rungs are left to the prefetcher; nothing while a raster is in flight).
  The view re-sharpens every ~15% of zoom travel instead of blurring until
  the commit — never more than ~7% from a crisp raster while zooming.
- **Deeper warm-up** — the idle prefetcher warms rung ±2 around the current
  zoom (riding's ammunition); deviceMemory ≥ 8 machines get 10 cache slots /
  48M px total budget.
- **Placement hot path** — handleCanvasClick had a shared TAIL updateUI()
  running on every canvas click IN ADDITION to per-branch calls: placements
  rebuilt the sidebar twice per click, synchronously. Now exactly one
  debounced (~120ms) refresh at the tail; the mark itself still paints
  synchronously via renderAnnotations. Rapid counter/line placement no
  longer pays O(sidebar) per click.
- **desynchronized: true** presentation hint on the pdf/crop/ann canvases
  (Chrome honors it; others ignore it) — lower input-to-photon latency.
- **Interaction-latency telemetry** — sample rings (cap 200) for placeMs
  (counter click → mark painted), zoomCrispMs (last gesture input → first
  crisp base paint), and the per-piece costs undoSnapshotMs /
  renderAnnotationsMs / updateUIMs; p50/p95 summaries via
  `App.__perfSamples()` and riding the Save Status envelope through
  captureDisplayInfoObj — "feels slow" reports now arrive with numbers from
  the user's own machine and projects.

New regression: [instant-feel.spec.js](instant-feel.spec.js) (mid-gesture
base swaps via cache hits, sidebar sentinel survives a placement click and
the debounced refresh lands, telemetry shape). Full suite 121 passed / 11
cloud-gated skips.

---

## perf(render-worker): pdf.js rasters move off the main thread (option 4)

Wendi's "work jumps around while zooming" persisted after the caching work —
the remaining cause is that any raster (cold zoom, idle refine, prefetch) on
a dense sheet blocks the main thread for seconds, starving the gesture rAF so
queued input lands late. This lands the structural fix:

- **[render-service.js](render-service.js)** — the single seam every pdf.js
  raster flows through (`raster({pdfPage, scale, rotation, offsets,
  canvasContext, kind})`, returning the exact RenderTask `{promise, cancel}`
  + `RenderingCancelledException` contract, so renderPdf/prefetch/tile kept
  their cancel/pending machinery unchanged).
- **[render-worker.js](render-worker.js)** — a dedicated worker running its
  own pdf.js 3.11.174 over its own copy of the document bytes, rastering
  into OffscreenCanvas and posting back transferable ImageBitmaps. The
  worker's pdf.js needs an explicit nested `workerPort` (no `window` in
  worker scope ⇒ pdf.js assumes Node ⇒ its fake-worker fallback needs
  `document` and dies — found by the new spec).
- **Lazy, site-free document adoption** — instead of wiring the ~14
  getDocument call sites, the first worker-eligible raster reads the bytes
  back out of pdf.js via `pdfPage._transport.getData()` (pinned-version
  private API, guarded) and ships them over; new docs re-adopt by transport
  identity with generation guards; rasters run main-thread while adoption is
  in flight.
- **Gates + fallback**: Worker/OffscreenCanvas support, the
  `window.DISABLE_RENDER_WORKER` config escape hatch, a deviceMemory ×
  doc-size cap (the worker holds a second copy of the doc); ANY worker
  failure permanently falls back to main for the session and logs
  `render_worker_fallback` to the Save Status log for diagnosability.
- **Spec infrastructure**: the specs that wrapped `pdfPage.render` to count
  or delay rasters (page-switch-cache, rung-prefetch, commit-tile) now use
  the seam's hooks (`App.__renderServiceStats` with a per-request kind+page
  log, `App.__setRasterTestDelay`) — mode-agnostic, so the whole suite
  exercises the worker path in Chromium. New: render-worker.spec.js
  (adoption, worker rasters, escape hatch) + render-service.test.js (5 node
  tests for the seam contract).

---

## fix(zoom): continuous zoom values + the intermittent black screen

Field feedback on the zoom ladder (below): Wendi wanted her zoom percentages
continuous (not snapped to 115%/132%…), and hit an intermittent black screen
while zooming in and out. Both addressed:

**Continuous zoom (the ladder becomes raster currency only).** state.zoom is
never snapped again — `snapCommitZoom` is gone. Instead `renderPdf` gained a
lookup ladder: the exact display zoom's bitmap if cached, else the nearest
RUNG's bitmap — blitted with the ≤7% residual carried by CSS sizing (new
`currentRenderZoom` global = the zoom the buffer actually represents; it
feeds `toCanvas`, the overlay draw env, and the legend/grid scales so marks
stay glued), else a fresh EXACT raster. A rung-served view schedules an idle
**exact-refine** (600ms) that re-rasters at the precise display zoom, so the
settled view is always pixel-perfect. The idle prefetcher now warms the rung
nearest the current zoom plus both neighbors unconditionally, and
`doZoomIn/Out` are back to the familiar ±0.1 steps (served from rung bitmaps
→ still instant).

**Black-screen fixes** — three real bugs from the ladder work:
1. An idle/pan-end crop-tile call during a tile-first commit cleared the
   force tile and DROPPED its chained full render — the view stuck on the
   stretched preview (dark margins on dark sheets). Chain ownership is now
   explicit (`cropTileOnDone`): idle calls never disturb a pending commit
   tile, and only the owner runs or replaces the chain.
2. `commitZoomRender` pre-set `lastRenderedZoom` before calling `renderPdf`;
   when a raster was already in flight renderPdf early-returns, so the
   preview transform snapped to scale 1 around OLD content — a wrong-scale
   flash with dark background. `lastRenderedZoom` is now owned exclusively
   by renderPdf's paint sites.
3. A superseded crop-tile task's catch handler zeroed the canvas the
   replacement tile was actively rendering into.

Specs updated to the new contracts: zoom-ladder.spec.js (continuous commits,
rung-served blits with frozen miss-stat, exact-refine lands the exact
buffer), commit-tile.spec.js, rung-prefetch.spec.js (gate on actual cache
keys — the `prefetched` stat is lifetime), zoom-rail.spec.js (±0.1
restored), page-switch-cache.spec.js (neighbor-page prefetch now runs after
the rung prefetches).

---

## perf(zoom): the zoom ladder — instant-feeling zoom on big files

Follow-up to perf(render) below. Wendi's remaining report: after a zoom the
page "takes a few moments to re-render to a higher pixel count" — a continuous
wheel zoom commits at an arbitrary value (187.3%…), so the bitmap cache almost
never had that exact level and nearly every commit was a fresh full-page
raster. Three changes make committed zooms repeat-visited and the remaining
cold rasters small:

1. **Zoom ladder (commit-snap).** New pure helpers in constants.js
   (`ZOOM_LADDER_STEP` 1.15, `snapZoomToRung`/`nextRungUp`/`nextRungDown`,
   node-tested; the clamp ends count as rungs so drag-to-max commits max).
   Gesture previews stay continuous; `commitWheelZoom`/`commitPinchZoom` snap
   to the nearest rung with the gesture anchor preserved
   (`snapCommitZoom`), and `doZoomIn`/`doZoomOut` step exactly one rung.
   Repeat zooming now revisits identical zoom values → cache blits.
   Regression: [zoom-ladder.spec.js](zoom-ladder.spec.js) (buttons step
   rungs, wheel commits land on-rung with the anchor within ±2px, rung
   revisits add zero visible-path rasters); the zoom-rail ± spec updated to
   the rung contract.
2. **Adjacent-rung idle prefetch.** `runPdfBitmapPrefetch` candidates are now
   current page @ rung±1 first (when sitting on a rung), then neighbor pages
   @ fit; cache slots 4 → 6 (the total-px budget stays the memory bound).
   The next zoom step in either direction is typically a one-frame blit.
   Regression: [rung-prefetch.spec.js](rung-prefetch.spec.js).
3. **Window-first cold commits.** A commit onto an uncached rung paints the
   VISIBLE WINDOW at the new zoom first (the crop tile in `force` mode —
   bounded, screen-sized raster, skipped when it wouldn't beat ~70% of the
   full-page raster), then chains the full-page raster via `onDone`;
   `renderPdf` keeps a target-matching tile up during that raster and retires
   it the moment the crisp base paints (tile keys carry `baseZoom` — during
   the tile-first phase the tile is authored in old-base container units and
   rastered at the new zoom, so it displays screen-sharp under the still-
   scaled preview). Debug hook `App.__pdfBitmapCacheKeys` added alongside the
   stats hook. Regression: [commit-tile.spec.js](commit-tile.spec.js) (slow
   full rasters simulated by wrapping `pdfPage.render`; asserts the tile is
   up mid-raster with the old base unswapped, retires on the crisp paint, and
   that warm commits blit with no tile at all).

---

## perf(render): big-file zoom/edit responsiveness (the "jumps around as files get bigger" bug)

User report (Wendi): on large sheets, "you zoom and then after the fact it
moves beneath you", and "you go to add a drop and it loads several seconds
after the fact". Root cause was one amplifier — pdf.js rasters the whole page
on the main thread, seconds on dense sheets — multiplied by four app-side
mistakes, each fixed here:

1. **Annotation-only edits re-rastered the PDF.** ~60 call sites (drop
   add/clear/±, line/counter colors, icons, curve style, group + room edits,
   zone create, legend/grid settings, scale changes, canvas-layer switches,
   Escape-clearing previews, …) ended in `renderPdf()` — and the overlay
   repaint only ran in the raster's completion callback, so the new drop
   appeared seconds later. All reclassified to `renderAnnotations()` (a few
   ms, sheet-size-independent). The one deliberate keep discovered by test:
   `rotatePage90` genuinely changes the raster (page-switch-cache.spec caught
   the misclassification).
2. **Queued wheel input landed "after the fact".** During a raster stall the
   rAF is starved while wheel deltas accumulate; the backlog then applied as
   one giant step at a stale anchor — and the old linear factor
   `1 − delta·k` went NEGATIVE for big backlogs, slamming the zoom clamp to
   20%. Now: sign-safe `exp(−x)` step (same feel for live gestures), per-frame
   step clamp (±0.6 exponent ≈ 1.8× max), and accumulated deltas older than
   150 ms are discarded as stall backlog.
3. **The bitmap cache stored nothing on Retina displays.** The retention
   budget `min(0.15 × maxArea × safety, 5M px)` sat BELOW a 2×-display
   fit-zoom buffer (~6M px), so every zoom commit / page flip / re-render was
   a full raster. New budgets: frac 0.35, per-entry 16M px + whole-cache 24M
   px (halved via `navigator.deviceMemory ≤ 4`), total-area eviction in
   `pdfBitmapCachePut`.
4. **Zoom commits ran the full `updateUI()`.** Nothing in the sidebar rebuild
   depends on zoom; commits (wheel/pinch/±) now run the light
   `syncZoomIndicators()` only — the end-of-gesture jank spike is gone.
   zoom-no-updateui-during-gesture.spec.js updated to the new contract (no
   full updateUI anywhere on the zoom path, with a spy-validity check).
5. **Deep zoom sharpening: the crop tile** (`// SECTION: Deep-zoom sharp crop
   tile`, #cropCanvas). When `effectiveDpr` clamps below devicePixelRatio the
   base render is soft; the app now rasters just the visible window at full
   dpr into a small content-space canvas sandwiched between the PDF canvas and
   the annotation overlay (rides the container transform, so pans keep it
   glued and zoom previews scale it). Debounced 200 ms after a render/pan
   settles; cleared at `renderPdf` entry; hidden until its raster completes;
   guarded by the same render-area budget; best-effort. New regression:
   [crop-tile.spec.js](crop-tile.spec.js).

---

## refactor(canvas-draw): unify the two annotation draw paths behind one core

The PDF Rendering region's structural duplication — `renderAnnotations` (live
overlay, ~620 lines) and `renderAnnotationsToContext` (export/thumbnail, ~450
lines) painting the same eight mark kinds in two coordinate spaces — is gone.
New [canvas-draw.js](canvas-draw.js) (766 lines) exports `createCanvasDraw(deps)`
(the save-engine seam recipe: app.js instantiates once with live-value accessor
arrows) plus the pure `drawDropMarker`/`hexToRgb`/`lineStyleToDash`. The factory
owns `drawAnnotationsCore(ctx, ann, env)` — ONE painter for quickLines →
polylines → highlights → multiplyZones → scaleZones → roomBoxes → notes →
counterMarkers — where `env` is the explicit **divergence register** between the
paths (transform, constant-screen vs export-scaled line width, font scale, label
pad, dot radius, counter sizes, `DM Sans` vs `sans-serif`, selection glow, note
handles; historical quirks preserved and commented). `drawRoomBoxesToContext`,
`drawLegend`, and `drawGrid` moved in too. Both former paths are now thin
env-builders with frozen signatures (the 5-arg `renderAnnotationsToContext`
contract consumed by export-pdfs/output/pdf-bundle/summary-detail is untouched)
— **a new annotation kind is drawn once**. Executed in four gated stages:
(0) [render-pixels.spec.js](render-pixels.spec.js), a pixel-regression safety
net comparing the raw canvas buffers of both paths against committed baselines
at `maxDiffPixels: 0` over a fixture exercising every mark kind; (1) pure moves;
(2) core + export rewire; (3) live rewire; (4) legend/grid + docs. Every stage
landed pixel-identical. [canvas-draw.test.js](canvas-draw.test.js) adds 10 node
tests (recording 2D-context Proxy stub): env invariants (selection glow, font
family flow, note-handle gating, dot radius, ring solid/hollow, paint order) +
the pure helpers. app.js 8,134 → 7,147 lines; the PDF Rendering section 1,576 →
589 (what remains is genuinely live-path: `renderPdf`, the scale-reference UI,
the in-progress rubber-band previews).

---

## feat(room-sizer): the Room Sizer — room boxes with heights and volumetric totals

First HVAC-oriented feature. A new header tool (cube icon, `TOOL.ROOM`, hotkey
V, page scale required) draws two-corner room boxes on the plan; each box gets
a ceiling height (feet-inches parse, recent-height chips persisted in
`recentRoomHeights`) and a **Room** (new palette object `state.rooms[]`
`{id,name,color}` beside groups — multiple boxes per room aggregate, covering
L-shaped rooms). Boxes live per-canvas as `annotations.roomBoxes[]`
`{x1,y1,x2,y2,heightFt,roomId,id}` in PDF-space and ride every persistence
surface (cloud save/autosave, IDB takeoff backup, export/import JSON,
view-links, pdf-intake restore, undo/redo snapshots, page rotation, Delete
Area, orphan-room reconcile). All math is feet-first via the pure
`roomBoxDimsFeet` (geometry.js) with scale zones honored through
`getEffectiveScaleForLine`; multiply zones deliberately do not multiply
volumes. Surfaces: on-canvas name + W×L×H labels (shared with exports via
`drawRoomBoxesToContext`), a Rooms sidebar section (appears with the first
box; jump-to-page + delete per box; room rename/recolor/delete cascade),
legend room-volume rows (`legendSettings.showRooms`, default on), and a "Room
Volumes" table in the report + email summary (guarded `window.App` lookup so
report.js's frozen `window.*` contract is untouched). New files:
[features/room-sizer.js](features/room-sizer.js),
[room-sizer.spec.js](room-sizer.spec.js); unit coverage in geometry.test.js +
annotation-model.test.js. Also fixed in passing: `annotation-model.js` was
missing from the service-worker `PRECACHE_URLS` (offline shell would 404 it).

## refactor(save-engine): Stage 6 — the save paths (extraction COMPLETE)

Sixth and final stage: the save paths move behind the seam — `performAutoSave`
(checkout preflight, update/insert with raw-fetch fallback + retry, abort
handling), `performSaveProjectToCloud` with the whole PDF upload ladder
(`uploadPdfToStorage`, resumable/TUS `uploadPdfResumable` with cross-reload
resume, `confirmPdfUploaded` verify-after-timeout), the one-shot
`uploadLocalPdfToCloudIfNeeded`, the outcome/telemetry core
(`noteAutoSaveOutcome`, `recordAutosaveLatency`, `updateSyncPausedBanner`,
`retrySyncNow`, `autosaveEventDetail`, the network captures), and the
Stage 2-deferred envelope builders (`getProjectSummaryForLogs`,
`buildSaveLogsEnvelope(+WithSnapshots)`, `writeSaveLogsSnapshot`, the per-tab
session id). Engine-owned: `autoSaveDirty` itself, the save-in-progress
flags, the in-flight autosave promise/controller/abort-reason, the failure
ladder + backoff + milestones + latency samples, the sync-paused banner
state, the last-success stamp, the envelope snapshot throttles, the upload
progress sink, and the one-shot backoff. **What stayed:** the boot wiring
(5s autosave interval, visibilitychange/online handlers — now calling
`saveEngine.maybeWriteDirtySnapshot()` / `abortInFlightAutoSave()`), the UI
renderers (updateStatus / getCloudSaveSummary / the bell) reading engine
getters, `lastSaveIncludedPdf` (load paths write it), and
`captureDisplayInfoObj` (render internals, via ctx). **Graduations:** 14 ctx
entries left the contract (getAutoSaveDirty/set, autosaveEventDetail,
noteSupabaseCallOk, getConsecutiveAutoSaveFailures, clearAutoSaveBackoff,
isSaveInProgress, getInFlightAutoSavePromise, getLastSuccessfulSupabaseCallAt,
performAutoSave, uploadLocalPdfToCloudIfNeeded, setPdfUploadProgressHandler,
setLastCloudSaveAttemptFailed, captureNetworkInfoDetail); 6 arrived
(getServerClockOffsetMs, captureDisplayInfoObj, getMaxZoom,
assertPdfWithinLimit, maybeLogProjectSaveEvent, setLastSaveIncludedPdf); five
orphaned wrappers deleted. Two local `ctx` shadows in the moved code were
renamed (`uploadPdfToStorage`'s options param, `autosaveEventDetail`'s
accumulator). save-engine.test.js grew to 44 tests (autosave happy/suspended/
failure + milestone ladder, retry/reset bookkeeping, one-shot skip ladder,
manual-save paths, envelope shape) with node stubs for document/fetch/rAF.
app.js ends at ~9.9k lines (from 13,993 pre-modularization); the engine is
~2.9k and fully node-testable.

---

## refactor(save-engine): Stage 5 — the checkout-UX domain

Fifth stage: the checkout domain moves behind the seam — the realtime
checkout subscription cluster deferred from Stage 4
(`subscribeToProjectCheckoutChanges` + reconnect backoff/generation guard +
`refreshProjectPermissions`, including its force-turn-in flush), the expired
recovery core (`computeCheckoutExpiryAgeMs`, `reCheckOutAfterExpiry`, the
silent auto-recheckout ladder with its per-project cap/cool-down Maps,
`handleBackgroundCheckoutExpired` — which also absorbed the app-side
supabase-disabled no-op forward declaration), and the Turn In core
(`doTurnIn` with its staged progress/retry/raw-fetch check-in). Engine-owned:
the channel + reconnect state, the recovery/background in-flight guards, the
auto-recheckout rate limits, the one-shot expired toast, the recovery-save
promise, and `turnInInProgress` (getter feeds the envelope + the discard
guard). **What stayed:** the recovery modal (open/apply/close + wiring), the
Turn In result-handling UX (`doTurnInAndHandleResult`/`tryTurnIn`), the
checkout/force-check-in buttons, and `formatExpiryAge` — modal wiring is
app.js's job; the engine reports outcomes and flips the attention flags via
ctx. **Graduations:** ctx.resubscribeCheckout / ctx.onCheckoutChannelDropped /
ctx.handleBackgroundCheckoutExpired left the ctx (engine-internal now); the
`rawCheckInProject`/`rawListAccessibleProjects` wrappers were deleted (their
only callers moved in). ctx grew by 17 (stage-6 save-path state via get/set +
UI hooks); save-engine.test.js grew to 35 tests (subscription wiring,
permission refresh, recovery paths, recheckout cap ladder, Turn In stages).

---

## refactor(save-engine): Stage 4 — the client-resilience layer

Fourth stage: the wedged-client machinery moves behind the seam —
`noteSupabaseJsFailure` (+ the failure stamp `doTurnIn` consults),
`runRecoveryProbe` (the raw-fetch connection probe), `runSupabaseClientProbe`,
`recreateSupabaseClient`, the two orchestrators
(`runRecoveryProbeAndMaybeRecycle`, `recycleClientIfWedgedOnIdleReturn`), and
all four raw-fetch fallbacks. Engine-owned: the in-flight guards, the recycle
cooldown/per-run count, and the wedge stamp, with getters for the app-side
readers (turn-in's `sbJsRecentlyBad`, the save paths' recycle-in-flight
guards, the envelope's `clientRecycles`). **Client ownership decision:** the
`supabase` let stays app-side (its ~100 bare readers are untouched); the
recycle — its only reassigner besides boot — writes through `ctx.setSupabase`,
and re-subscribes through `ctx.resubscribeCheckout` (the subscription cluster
itself is Stage 5). `updateSyncPausedBanner`/`retrySyncNow`/
`recordAutosaveLatency`/`noteAutoSaveOutcome` + the telemetry capture helpers
stay app-side (stage-6 lets). Two wrappers were deleted rather than kept
(`runSupabaseClientProbe`/`recreateSupabaseClient` — their only callers moved
with them). ctx grew by 7; save-engine.test.js grew to 21 tests (failure
filtering, recycle happy-path/cooldown with a stubbed `window.supabase`,
orchestrator early-exit, raw-insert token guard).

---

## refactor(save-engine): Stage 3 — the storage ring

Third stage: `probeCheckoutLock` (which **graduates from the ctx to
engine-internal** — the keep-alive now calls it directly), `sha256Hex`, the
`takeoffBackupGet`/`takeoffBackupPut` cross-user-mismatch + one-shot-warn
wrappers, and the whole three-layer local-backup writer
(`writeTakeoffStateBackup` → `writeTakeoffBackupToIndexedDB` → the takeoff
serializer) move behind the seam, with the engine owning
`takeoffBackupWriteInFlight`, `takeoffBackupWarnShown`, and the
`lastLocalBackupAt`/`lastLocalBackupOk` stamps. The 1s dirty→backup debounce
also graduated from ctx (`markProjectDirty` kicks it internally). App-side:
the 5s interval + the visibilitychange backup kick call the wrappers;
`updateStatus` reads the stamp via a shadowing
`const lastLocalBackupAt = saveEngine.getLastLocalBackupAt()`;
`BACKUP_PDF_TO_INDEXEDDB` is now solely the idb.js classic-script global
(exported from its footer for lint/tests; app.js's duplicate const removed).
ctx grew by 6 (serverNowMs, noteSupabaseCallOk, perfLog, getUserCustomIcons,
computePageBakeFrame, getLastModifiedAt) and shrank by 2 (the graduations).
save-engine.test.js grew to 17 tests with stubbed idb primitives — the
backup writer, cross-user get, and probe now have Node coverage.

---

## refactor(save-engine): Stage 2 — the log core + dirty core (first engine-owned state)

Second stage: the engine now OWNS state instead of only borrowing accessors.
The Save Status **log core** moved in (`saveStatusLog` + `pushSaveEvent` /
`pruneSaveStatusLog` / `getSaveStatusLogWindowMs` + the `[SaveDebug]` helpers
`isSaveDebugEnabled`/`setSaveDebugEnabled`/`saveDebugRunId`/`saveDebugLog`/
`saveDebugLogError`), and the **dirty core** (`markProjectDirty` with
engine-owned `dirtyGeneration` / `dirtyStartedAt` / the 2s-throttled dirty
event). app.js keeps same-named wrappers for the ~230 call sites;
`App.getSaveStatusLog` delegates to the engine getter; the save paths read
generations via `saveEngine.getDirtyGeneration()`; `resetLocalSessionState` /
`resetAutosaveDegradedState` call the engine's `resetDirtyTracking` /
`clearDirtyStartedAt` / `clearSaveStatusLog`. Deliberately app-side still:
`autoSaveDirty` + `lastModifiedAt` (their primary writers are the Stage-6
save paths — the engine reaches them via ctx get/set), the debounced
local-backup kick (`ctx.scheduleTakeoffBackup`; the writer moves in Stage 3),
the envelope builders (wired to a dozen later-stage lets), and
`resetLocalSessionState`/`resetAutosaveDegradedState` (orchestrators). The
undo/redo machinery that shared the old dirty-tracking section got its own
honest `// SECTION: Undo/redo stacks` marker (it was never sync).
save-engine.js gained its own eslint group (constants + save-utils globals);
save-engine.test.js grew to 13 tests, now asserting against the engine's own
log (Stage 1's ctx-spy assertions were rewritten accordingly).

---

## refactor(save-engine): Stage 1 — the createSaveEngine(ctx) seam

First stage of the staged save/sync-engine extraction (the endgame after the
modal-ladder splits #25–#33). A feature-file split can't work for the engine
(feature files load after app.js, but boot needs the engine, and its ~48
reassigned `let`s are written from both sides), so the shape is the *other*
proven pattern scaled up: **[save-engine.js](save-engine.js)** as a classic
script in the pre-app.js slot exporting `createSaveEngine(ctx)`. app.js
instantiates it once near the top of its IIFE, passing accessors/callbacks
that resolve live values at call time (`getState`, `getSupabase`,
`isSupabaseEnabled`, `withTimeout`, `pushSaveEvent`, `saveDebugLog`,
`probeCheckoutLock`, `handleBackgroundCheckoutExpired`, `isAutoSaveSuspended`,
`getLastCheckoutRefreshAt`), and keeps **same-named thin wrappers** so every
call site, the App registry, and the `window.*` contracts stay frozen.

Stage 1 proves the seam on the two leaf clusters: `[sync] Global force
reload` (check + reload + the pending-stamp commit listener, installed via
`saveEngine.installGlobalReloadStampCommit()` at load + the banner) and
`[sync] Checkout keep-alive` (the visible-tab lock probe). Their `[sync]`
markers stay in app.js heading the wrappers, so `rg "SECTION: \[sync\]"`
still finds the whole subsystem. New
[save-engine.test.js](save-engine.test.js) gives the engine its first Node
unit coverage via a fully stubbed ctx (keep-alive skip ladder + expiry
routing; force-reload decision incl. the pending-stamp write). Groundwork
laid beforehand (same day): the Stage 0 smoke spec, dev-auth for the cloud
battery (suite baseline 120 passed / 1 known-red), and a telemetry baseline
envelope.

---

## perf: large-plan responsiveness, phases 1+2 (zoom gestures + page-switch bitmap cache)

**Problem.** On large multi-page plans, zooming lagged with erratic jumps and page switches
took seconds. Two root causes: (1) the wheel-zoom rAF and zoom-rail drag ran the full
`updateUI()` **every frame**, and `updateUI()` rebuilds every sidebar list with
O(all annotations across all pages) length math (16–31ms/call measured on a seeded 40-page
project — frames blew the 16ms budget, wheel deltas accumulated, the zoom lurched); (2) every
page switch re-rasterized the whole sheet from scratch via pdf.js, and rapid flips serialized
full renders of every intermediate page.

**Phase 1 — zoom gestures never run the full updateUI:**

- New `syncZoomIndicators()` (zoom-% readout + rail-thumb sync only): the wheel rAF, pinch
  rAF, and zoom-rail drag use it per frame; the full `updateUI()` still runs exactly once at
  the debounced gesture-end commit. Published as `App.syncZoomIndicators` for
  [features/zoom-rail.js](features/zoom-rail.js).
- `updateUI()` win A: new `getPipeToolingHasData()` (report.js, on `window`) replaces the
  `getPipeToolingSummary().length > 0` existence check — same counts-or-lines rule, but
  short-circuits at the first hit instead of building the whole summary per updateUI call.
- `updateUI()` win B: `getActiveCanvas`/`getActiveAnnotations` accept an optional `pageIdx`
  hint (validated, `indexOf` fallback) so the all-pages loops in the sidebar renderers and
  report walkers stop paying an O(pages) `indexOf` per page — removing the O(pages²) factor.
- Measured after: per-frame gesture work ~0ms (was 16–31ms). Regression:
  [zoom-no-updateui-during-gesture.spec.js](zoom-no-updateui-during-gesture.spec.js)
  (sidebar sentinel survives the gesture; `#zoomPct` tracks per frame; exactly one
  `updateUI()` at the commit).

**Phase 2 — PDF render bitmap cache:**

- New `// SECTION: PDF render bitmap cache`: an LRU (max 4) of rendered-page `ImageBitmap`s
  keyed by the **self-validating** tuple (pdfPage proxy identity + rotation + zoom +
  effDpr) — automatically invalidated by page deletes, prepare-pdf's `pdfPage` rebinds,
  undo's in-place rotation writes, wrapper resizes, and `renderAreaSafety`/caps changes.
  Area-capped per entry at min(0.15 × maxArea × safety, 5MP) so deep-zoom giants are never
  cached (worst-case retention ~20MB); every evict/drop/clear `close()`s the bitmap; a
  generation counter makes async inserts self-discard across clears. Entries are snapshotted
  from the offscreen pre-free, post read-back guard (never a blank), using a key tuple
  **captured at render start** so a cancel-lost race can't poison the cache (the same
  capture fixed a pre-existing hole where a mid-gesture completion set `lastRenderedZoom`
  from live state and made `commitWheelZoom` skip its crisp re-render).
- `renderPdf` cache-hit fast path: synchronous blit (no pdf.js), with a blank read-back
  mirroring the full path's pressure response (drop + clear + ratchet + re-enter).
- Rapid-flip cancellation: the in-flight guard now `cancel()`s the running render task
  (double-cancel guarded), landing in the existing `RenderingCancelledException` handling.
- Stale-blit preview: switching to a page cached at a different zoom paints it scaled
  immediately; the crisp render replaces it.
- Idle prefetch (250ms after a settled render) rasters `currentPage±1` at predicted fit
  zoom into the cache via a dedicated scratch canvas; skipped under memory pressure/hidden
  tab; cancelled by any `renderPdf` entry and by wheel/touchstart/pointerdown (pdf.js runs
  operator lists in main-thread chunks — speculation must never jank a gesture).
- Cache clears are wired at every `state.pages` rebuild / `pdfPage` rebind site (app.js ×7,
  features/prepare-pdf.js both branches, features/load-project.js ×3 via the new
  `App.clearPdfBitmapCache`) plus the ratchet branch. Debug seams:
  `App.__pdfBitmapCacheStats`, `App.__pdfBitmapCacheDump`.
- Measured (40-page synthetic): cold switch 64ms raster; revisit 6ms blit; prefetched
  neighbor first visit 12ms blit. On real dense sheets cold is seconds, so hits are the
  difference between instant and unusable. Regression:
  [page-switch-cache.spec.js](page-switch-cache.spec.js).

---

## fix(auth): INITIAL_SESSION no-session event wiped view-link projects

**Problem.** Share/view links (`/app/?t=<token>`) loaded the project and then went black on any
device with **no signed-in Supabase session** (fresh phones being the common case — "works on my
desktop, not on my phone"). `initViewOnlyMode` finished loading the project, then `initSupabaseAuth`
subscribed `onAuthStateChange`, and supabase-js v2 fires an immediate `INITIAL_SESSION` event on
subscription. With no session that event fell into the signed-out branch, whose per-user data
hygiene called `resetLocalSessionState()` unconditionally — wiping `state.pages` /
`currentProjectId` / `loadedViaViewLink` milliseconds after the view project loaded. Signed-in
browsers took the session branch instead, which is why desktop appeared fine. The same
unconditional wipe could also clobber a signed-out local session's restored backup at boot.

**Fix.** The signed-out branch wipes only on a **real** sign-out — `hadSession` (a user id existed
in this tab) — and never in a view-link tab (`state.loadedViaViewLink`), whose project access rides
on the token + email gate, not the session. `broadcastSignOut()` keeps its existing `hadSession`
gate. Diagnosed by tracing `state.pages`/`state.zoom` writes on the live link: pages went
`0 → 1 → 0` 13ms after `fitZoom`, stacked under the auth callback.

---

## feat(scale): "verify your scale" advisory + check mode

**Problem.** A preset / custom architectural scale is an assumption (the PDF is printed to true
scale), and even the sheet-size correction is a best guess — nothing prompted the user to confirm
it, so a wrong scale silently propagated into every length tally.

**Fix.** Two additions to the Set Scale modal, over the existing two-point pick flow:

- **Advisory** — a persistent **blue** `#scaleVerifyAdvisory` banner atop `#scalePresetsPanel`
  (covers presets + the custom row, which share the panel), calmer than the yellow sheet warning.
  Its **Verify by measuring two points** button (`startScaleCheck`) reuses the two-point pick flow
  (all input paths — mouse, touch, aim-loupe — funnel through the one `handleCanvasClick`
  `TOOL.SCALE` branch), gated by a new `state.scaleCheckMode` flag.
- **Check mode** — after the two points, `openScaleModal` routes to `#scaleCheckPanel`; the user
  enters the line's **known** length and **Check** calls the pure `scaleCheckDelta(distPts, scale,
  knownVal, knownUnit)` ([geometry.js](geometry.js)) → `{ reading, deltaPct }`, showing Expected
  vs "current scale reads" + the **% error** (green < 1%, yellow otherwise). **Keep current scale**
  leaves the preset; **Use measured** recalibrates via the shared `applyTwoPointScale` (extracted
  from `#scaleSet`, stamps a `refLine`). A brief **post-apply toast** fires whenever a preset/custom
  scale is set.

`resetScaleCheckMode` (published on `App`) unwinds the flag from every modal exit and the two
Escape-key `TOOL.SCALE` branches in app.js. Registry gains `App.scaleCheckDelta` /
`App.convertUnitValue` / `App.formatFeetInchesFromVal` / `App.resetScaleCheckMode`. Tests:
`scaleCheckDelta` cases (exact → 0%, 2× → 100%, cross-unit) in [geometry.test.js](geometry.test.js).

---

## fix(scale): sheet-size correction for compressed / re-boxed PDFs

**Problem.** Annotations are stored in PDF points and real lengths are
`geometricPdfPts / pixelsPerUnit`. The architectural presets ([constants.js](constants.js)
`SCALE_PRESETS`) and the custom dialog hard-code `pixelsPerUnit = fractionInches * 72 / feet`,
which only holds when the PDF page's point space equals the true physical sheet size
(72 pt = 1 real inch of paper). When a PDF is "compressed" / re-boxed / rasterized-and-rescaled,
the page MediaBox shrinks while still depicting a `1/4"=1'` drawing, so the preset is off by the
rescale ratio (a half-size page reports a 10 ft wall as 5 ft). Two-point "Select on PDF"
calibration (`pixelsPerUnit = ptDist/realLength`, no `72`) was the only immune method.

**Fix (three layered surfaces over one page-size analysis):**

- **Detect & warn (A).** [geometry.js](geometry.js) gains the pure `STANDARD_SHEETS` table
  (ANSI A–E, ARCH A–E + E1, ISO A0–A4, edges in points) and `analyzeSheet(w, h)` →
  `{ isStandard, matchedSheet, bestGuessSheet, candidates }` (orientation-normalized; standard =
  within ~3% of a real sheet; otherwise aspect-ratio candidates within ~2%, ties → larger sheet).
  app.js wraps it as `getPageSheetAnalysis(pageIdx)` (unrotated viewport dims) and publishes it
  + `STANDARD_SHEETS` + `sheetCorrectionFactor` on the `App` registry. On the presets tab in
  page-scale mode, a non-standard page shows the `#scaleSheetWarning` banner.
- **Correct (B).** `sheetCorrectionFactor(w, h, sheet) = actualLongEdge / sheetLongEdge`.
  `features/scale.js` multiplies the preset/custom `pixelsPerUnit` by it and stamps
  `scale.sheetSize` / `scale.correctionFactor` / a label suffix. **Page scale only** — the zone
  early-return in `applyScaleObjectToZoneOrPage` is untouched, and two-point is untouched. The
  picker (`#scaleSheetSelect`) defaults to the best guess and can override or disable. A
  standard-size page applies `correctionFactor` 1 with no banner (behavior byte-for-byte
  unchanged).
- **Verify (C).** `renderAnnotations` draws a synthetic dashed scale bar (round real length, ends
  + label) for preset/custom scales that lack a two-point `refLine`, reusing the existing
  `state.showScaleRefLine` toggle — a passive visual check and the backstop when a compression
  lands exactly on another standard size (e.g. half-size ARCH D == ARCH B).

New `scale` sub-fields auto-survive all persistence paths (cloud / IndexedDB / export / undo —
spread/JSON, no sub-field whitelist). Tests: `analyzeSheet` / `sheetCorrectionFactor` cases in
[geometry.test.js](geometry.test.js).

---

## Sync hardening

### PR 1 — Abortable timeouts, backoff, and the sync-paused banner

- `withTimeout(promiseOrFactory, ms, label)` now accepts either a plain promise
  (legacy) or a `(signal) => promise` factory, and exposes `.controller` on the
  returned promise. The 7 Postgrest write call sites in `performAutoSave`
  (update + insert) and `performSaveProjectToCloud` (5 update/insert sites) use
  the factory form with `.abortSignal(signal)`, so the underlying fetch is
  aborted when the timer fires — freeing dead HTTP/2 sockets the browser would
  otherwise reuse.
- Autosave update timeout dropped from 30s to `AUTOSAVE_TIMEOUT_MS` (15s); manual
  save timeouts remain 30s / 60s.
- `performAutoSave` captures `inFlightAutoSaveController` per request and nulls it
  in the outer `finally`.
- `noteAutoSaveOutcome(ok, err)` tracks `consecutiveAutoSaveFailures` /
  `firstAutoSaveFailureAt` / `nextAutoSaveAttemptAt`, applies capped backoff
  `AUTOSAVE_BACKOFF_LEVELS_MS = [5000, 15000, 30000, 60000]`, shows
  `#syncPausedBanner` at `AUTOSAVE_BANNER_THRESHOLD = 3`, and emits
  `autosave_recovered` (`{failures, durationMs}`) on first success after a failure
  run.
- The autosave interval gates with `if (Date.now() < nextAutoSaveAttemptAt) return;`
  (logs `autosave.skip / reason: backoff` when debug enabled).
- `#syncPausedBanner` (above the status bar) reads "Cloud sync paused - your work
  is saved locally. Reconnecting..."; `#syncPausedBannerRetry` -> `retrySyncNow()`
  (aborts `inFlightAutoSaveController`, resets `nextAutoSaveAttemptAt = 0`, sets
  `autoSaveDirty = true`, refreshes the session, emits `manual_sync_retry`).
- `visibilitychange -> hidden` aborts `inFlightAutoSaveController` unconditionally
  before the fire-and-forget pre-close save so the next save opens a fresh socket.
  Both abort sites set `autoSaveAbortReason` (`'user_retry'` / `'hidden'`); the
  `performAutoSave` catch detects the flag and suppresses the failure path (no
  failure-count bump, no backoff, no `autosave_err`, no yellow bell).

### PR 2 — Recovery probe, milestones, latency tracking

- `runRecoveryProbe(trigger)` fires fire-and-forget at the 5th consecutive failure
  (`AUTOSAVE_RECOVERY_THRESHOLD`) and on every `window.online` event when
  `consecutiveAutoSaveFailures > 0`. It refreshes the JWT via
  `supabase.auth.getSession()` then issues a raw
  `fetch(SUPABASE_URL + '/rest/v1/projects?select=id&limit=1', {cache:'no-store', signal, headers:{apikey, Authorization}})`
  with a 5s `AbortController` timeout (`AUTOSAVE_RECOVERY_TIMEOUT_MS`), bypassing
  the supabase-js connection pool so a dead H/2 socket gets replaced.
- Success resets `nextAutoSaveAttemptAt = 0` but leaves `consecutiveAutoSaveFailures`
  and the banner intact (a real save success drives those via
  `noteAutoSaveOutcome(true)`).
- `recoveryProbeInFlight` re-entrancy flag; `recoveryProbeFiredForFailureCount`
  per-failure-run dedupe; emits `autosave_recovery_probe` / `_ok` / `_err`.
- Milestone events `autosave_failing_3` / `_5` / `_10` fire once per failure run
  (dedupe `autosaveMilestoneFiredAt`, reset in `noteAutoSaveOutcome(true)`).
- `captureNetworkInfoDetail()` attaches `{effectiveType, downlink, rtt, saveData}`
  when `navigator.connection` exists (Chromium only).
- P8 latency: `recordAutosaveLatency(updMs)` after each `projects.update`; samples
  capped at `AUTOSAVE_SLOW_WINDOW = 20`; emits `autosave_slow` `{p95, n, latest}`
  when `p95 > AUTOSAVE_SLOW_MS = 1000` after `AUTOSAVE_SLOW_MIN_SAMPLES = 10`,
  debounced by `AUTOSAVE_SLOW_DEBOUNCE_MS = 60000`.

### PR 3 — Self-sufficient telemetry, snapshots, client recycle, raw-fetch fallback

- Every autosave/manual-save/turn-in event funnels through `autosaveEventDetail(extra)`
  so the exported envelope is self-sufficient (always-on `failures`, `online`,
  `msSinceLastSuccess`, `network`, plus per-event `runId`/`elapsedMs`/`attempt`/
  `phase`/`usedRawFetch`/`opMs`/`storageInfoStatus`/`storageInfoMs`/`code`/`status`/
  `name`).
- Previously verbose-only debug logs now emit always-on `pushSaveEvent` siblings:
  `autosave_storage_info_err` / `_skipped`, `autosave_request_start` / `_end`.
- `dirty` events carry `dirtyForMs`; on the first `markProjectDirty` transition
  `dirtyStartedAt` stamps so the 5s interval triggers `writeSaveLogsSnapshot('dirty_10min')`
  once when dirty for `DIRTY_SNAPSHOT_THRESHOLD_MS` (10 min), gated by
  `envelopeSnapshotDirtyStamp` (reset on `autosave_ok`).
- IDB bumped to version 5 with a `save_logs_snapshots` store
  (`SAVE_LOGS_SNAPSHOT_STORE`, cap `SAVE_LOGS_SNAPSHOT_MAX_ENTRIES = 10`) written
  by `writeSaveLogsSnapshot(reason)` and read by `readSaveLogsSnapshots(limit=5)`.
  `buildSaveLogsEnvelopeWithSnapshots()` (async) is what the Save Status modal
  Export/Copy buttons use; it attaches `autoSnapshotEnvelopes` so a tab reloaded
  between an incident and the user opening the modal keeps the failure timeline.
- `runRecoveryProbe` chains into `runRecoveryProbeAndMaybeRecycle(trigger)`: on
  raw-probe OK it runs `runSupabaseClientProbe(trigger)`
  (`supabase.from('projects').select('id').limit(1)`, `CLIENT_PROBE_TIMEOUT_MS = 5000`,
  `clientProbeInFlightGuard`); on client-probe failure it calls
  `recreateSupabaseClient(reason)` (`removeAllChannels()`, fresh `createClient`,
  `setSession`, re-subscribe checkout channel) — gated by `clientRecycleInFlight`
  and `CLIENT_RECYCLE_COOLDOWN_MS = 30000`; emits `autosave_client_recycled` / `_err`.
- `STORAGE_INFO_TIMEOUT_MS = 3000` (down from 10s); storage.info skipped while
  `consecutiveAutoSaveFailures > 0` or after a per-call failure flag
  (`autosave_storage_info_skipped` with `reason`).
- Raw-fetch fallback for `projects.update`: `rawProjectsUpdate(projectId, payload, signal)`
  PATCHes `/rest/v1/projects?id=eq.X` (apikey + Bearer + `Prefer: return=minimal`,
  `cache:'no-store'`); engages at `failures >= 3` or after an in-run supabase-js
  update timeout. Same gating in `performSaveProjectToCloud`'s no-PDF update.
- Raw-fetch fallback for Turn In: `rawCheckInProject(projectId, signal)` POSTs
  `/rest/v1/rpc/check_in_project`; `doTurnIn` enables it at `failures >= 3` or as the
  second attempt; preserves `updateServerClockFromRpc` and the `alreadyReleased`
  regex.
- `doTurnIn` tracks `stageStartedAt` so each `progress(stage, label)` emits a
  matching `turn_in_phase_done` `{stage, durationMs, elapsedMs}`; `turn_in_ok` /
  `turn_in_err` carry `usedRawFetchForCheckIn`.

### PR 4 — Checkout expired recovery UX

- When a Turn In click returns `CHECKOUT_EXPIRED`, instead of a one-shot toast the
  client opens `#checkoutExpiredRecoveryModal` (z-index 220). Helpers:
  `openCheckoutExpiredRecoveryModal({trigger})`, `closeCheckoutExpiredRecoveryModal()`,
  and sub-modes via `applyCheckoutExpiredRecoveryMode('default' | 'someone_else' | 'error', ctx)`.
- Primary **Re-check out and save** -> `reCheckOutAfterExpiry(trigger)` calls
  `check_out_project` (8s `withTimeout`); on success `clearCheckoutExpiredAttention()`,
  set self as holder, fire-and-forget `performAutoSave('checkout_recovered')`; on RPC
  failure `refreshProjectPermissions()` then swap to "someone else is editing" or
  error mode.
- Secondary **Export local backup** re-clicks `#exportBtn`. Tertiary **Discard
  local edits and reload** confirms, gates on `!saveInProgress && !turnInInProgress`,
  clears `autoSaveDirty`, `takeoffBackupDelete(currentProjectId)`, emits
  `checkout_recover_discarded`, reloads.
- `doTurnInAndHandleResult` short-circuits to the modal when
  `checkoutExpiredNeedsAttention` is already set (`turn_in_short_circuit_expired`).
- The header `headerEditStatusBanner` and `sidebarCheckoutBanner` add a fourth
  state `edit-status-expired` (yellow, pulsing) labeled "Edit session expired —
  Re-check out"; `handleEditStatusBannerClick` routes to the recovery modal. The
  Save Status modal renders `#saveStatusExpiredCallout` while expired.
- Events: `checkout_recovered`, `checkout_recover_blocked`, `checkout_recover_err`,
  `checkout_recover_discarded`, `turn_in_short_circuit_expired`. Expiry-age via
  `computeCheckoutExpiryAgeMs()`; `checkoutExpiredRecoveryInFlight` dedupes presses.

### PR 5 — Silent self-heal (auto-recheckout) layered under the modal

- `handleBackgroundCheckoutExpired(trigger)` is the single wrapper for all
  background `CHECKOUT_EXPIRED` detections (autosave loop, `visibilitychange ->
  visible` post-probe, `checkoutKeepalive`). It sets `checkoutExpiredNeedsAttention`
  + `suspendAutoSaveUntilCheckout`, emits `checkout_expired {trigger}`, calls
  `tryAutoRecheckoutIfAllowed`, and only falls back to the one-shot toast when
  auto-recovery is blocked. (Explicit user paths still open the modal directly.)
- `tryAutoRecheckoutIfAllowed(trigger)` gated by `AUTO_RECHECKOUT_MAX_PER_PROJECT = 3`
  (`autoRecheckoutCountByProject`), `AUTO_RECHECKOUT_MIN_GAP_MS = 5000`, and
  `state.canCheckOut === true` after a fresh `refreshProjectPermissions()`. Emits
  `auto_recheckout_attempt` / `_ok` / `_blocked {reason}` / `_err`.
- `reCheckOutAfterExpiry(trigger, opts)` takes `{silent:true}` so the auto path
  suppresses the "Re-checked out..." toast.
- `resetAutoRecheckoutCounter(projectId)` on sign-out, Close Project, and explicit
  user check-out.
- `projects.insert` always uses raw fetch — `rawProjectsInsert(payload, signal)`
  (POST `/rest/v1/projects`, `Prefer: return=representation`). All three insert
  sites bypass supabase-js and emit the raw-fetch events.
- Every project teardown/switch site calls `clearCheckoutExpiredAttention()` so
  expiry state cannot leak from project A to B in the same tab.
- `performAutoSave` adds a suspend gate at entry: when
  `suspendAutoSaveUntilCheckout && externalRunId !== 'checkout_recovered'` it returns
  `{ok:false, error:{code:'CHECKOUT_EXPIRED'}}`.
- The autosave new-project insert path now mirrors the manual-save insert sites
  (subscribe to checkout changes + hydrate owner/viewer/canCheckOut).
- `saveBeforeLoadSave`'s CHECKOUT_EXPIRED branch mirrors `doTurnInAndHandleResult`.

### PR 6 — Sign-out teardown foundation

- `resetLocalSessionState({keepArtboard})` clears pages, project ids, PDF buffers,
  dirty/save/turnIn flags, undo stacks, pending canvas/copy state, checkout fields,
  and calls `resetAutosaveDegradedState()` (resets all the degraded-mode counters,
  latency samples, snapshot stamps, client-recycle state, hides `#syncPausedBanner`)
  plus clears `saveStatusLog`, user-activity caches, auto-recheckout maps,
  warn-flags, and `clearCheckoutExpiredAttention()`.
- `SIGNED_OUT` -> `resetLocalSessionState()` (default `keepArtboard:false`);
  `settingsCloseProject` -> `resetLocalSessionState({keepArtboard:true})`.
- `lastAuthUserId` tracks the signed-in user id; `TOKEN_REFRESHED` runs full reset +
  re-hydration when `session.user.id !== lastAuthUserId` (`auth_user_changed_on_refresh`).
- `BroadcastChannel('clickcount-auth')` posts `{kind:'signed_out'}`; other tabs run
  `handleCrossTabSignOut` (via channel or `clickcount-signout-broadcast` localStorage
  fallback) -> `cross_tab_signout`.
- `checkInCurrentProjectIfHeld` wraps `check_in_project` in `withTimeout(..., CHECK_IN_TIMEOUT_MS)`
  and swallows timeouts (`signout_checkin_timeout`) so a stuck RPC never blocks
  `signOut()`.

### PR 7 — Cross-user data hygiene

- `takeoffBackupGet(projectId, currentUserId)` checks `entry.userId`; on mismatch
  logs `takeoffBackup.user_mismatch`, deletes the entry, returns null. All callers
  pass `state.supabaseSession?.user?.id`.
- Custom-icons IndexedDB key is per-user: `customIconsCurrentKey()` returns
  `customIcons_${userId}` when signed in (legacy `'user'` only when no session);
  first read migrates the legacy entry (`customIcons.migrated_to_per_user`).
  `resetLocalSessionState({keepArtboard:false})` clears `customIconsCache`.
- `refreshProjectPermissions` when `!proj` after a successful RPC flips to viewer +
  suspends autosave + toasts "You no longer have access to this project."
  (`permissions_project_missing`).
- Boot-time last-session restore tags `PGRST116`/denied/permission errors as
  `projectAccessDenied` and wipes both `clickcount-last-project` and the IDB takeoff
  backup (`last_session_restore_skip_inaccessible`).

### PR 8 — Dirty-flag correctness

- `dirtyGeneration` counter, incremented by every `markProjectDirty()`.
  `performAutoSave` and `performSaveProjectToCloud` capture
  `genAtEntry = dirtyGeneration` at the top, clear `autoSaveDirty = false` inside the
  save, and on success set `autoSaveDirty = (dirtyGeneration !== genAtEntry)` so edits
  typed during a save are not lost. On failure restore `autoSaveDirty = true` (manual
  save OR-s with `wasDirty`). The autosave interval, `doTurnIn`, and
  `saveBeforeLoadSave` no longer pre-clear `autoSaveDirty`.
- `reCheckOutAfterExpiry` awaits the recovery save via `inFlightRecoverySavePromise`;
  `doTurnIn` `Promise.race`-waits up to 8s on it before starting.
- `refreshProjectPermissions` retries `list_accessible_projects` once (500ms backoff)
  and emits `refresh_permissions_err` instead of corrupting checkout state.
- Force-turn-in flush skips `performAutoSave()` when `suspendAutoSaveUntilCheckout`
  (`force_turn_in_flush_skipped_suspended`).

### PR 9 — Manual-save expiry parity

- Manual Save's `confirmedExpired` branch stops flipping `state.isViewer` /
  `canCheckOut` locally; instead `await handleBackgroundCheckoutExpired('manual_save')`
  + `refreshProjectPermissions()`, and if not silently recovered, opens
  `openCheckoutExpiredRecoveryModal({trigger:'manual_save'})` — matching Turn In and
  `saveBeforeLoadSave`.
- `handleBackgroundCheckoutExpired` reentrancy-guarded by
  `backgroundCheckoutExpiredInFlight` so concurrent detections produce one event and
  one modal.
- `markProjectDirty`'s `refresh_checkout_activity` call gated on
  `!suspendAutoSaveUntilCheckout && !checkoutExpiredNeedsAttention` so edits in an
  expired state never extend the server lock.
- `tryAutoRecheckoutIfAllowed` no longer increments the cap before the RPC; transient
  errors do not consume the cap.
- Admin force turn-in success (`settingsForceCheckIn`, `forceCheckInProjectFromManage`)
  calls `clearCheckoutExpiredAttention()` + `resetAutoRecheckoutCounter`.

### PR 10 — Save-path failure safety

- `performSaveProjectToCloud` with-PDF new-project flow defers state hydration until
  after the PDF upload AND `projects.update` succeed; it captures
  `orphanProjectIdForCleanup` + `pendingNewProjectHydration` and, on failure between
  insert and update, deletes the orphan row (`manual_save_orphan_cleanup_ok` / `_err`).
- Centralized `assertPdfWithinLimit(bytes, context)` (50MB ceiling, emits
  `pdf_size_exceeded`); called from `commitPreparePdfToState` and before
  `storage.upload`.
- `writeTakeoffBackupToIndexedDB` gated by `takeoffBackupWriteInFlight` so concurrent
  callers reuse the in-flight write (`takeoff_backup_skip_inflight`);
  `writeTakeoffStateBackup` awaits an in-flight backup instead of starting a second.

### PR 11 — Boot + view-link ordering

- Boot order: `initSupabaseAuth()` runs BEFORE `takeoffBackupGet('local', uid)` +
  `applyTakeoffBackupToState`, so cross-user takeoff data never flashes before auth
  resolves. Legacy `localStorage.takeoff-state` is filtered by `userId`
  (`takeoff_backup_skip_other_user`).
- `initViewOnlyMode` follows up with `initSupabaseAuth()` so view-link tabs see the
  session (`view_link_session_attached`); forces viewer/canCheckOut/loadedViaViewLink.
- `doGlobalReloadNow` writes a `clickcount-pending-global-reload` stamp; the real
  `GLOBAL_RELOAD_STAMP_KEY` commits only after `load`/`pageshow` confirms the reload
  (`global_reload_committed`), so a blocked reload retries next time.

### PR 12 — Wedged-supabase-js recovery

- `isTransientSaveError` regex widened to match `withTimeout`'s own
  "… timed out after Ns" messages plus `AbortError` / `ECONNRESET` /
  `connection closed` / `socket`, so the once-only retry in `doTurnIn`,
  `performAutoSave`, and `performSaveProjectToCloud` actually fires on its own
  timeouts.
- The five raw-fetch-OK sites fire-and-forget
  `runRecoveryProbeAndMaybeRecycle('raw_fetch_rescue')` when
  `consecutiveAutoSaveFailures > 0 && !clientRecycleInFlight`, so a session where
  raw-fetch papered over a wedged supabase-js client now actively probes + recycles.
- `lastSupabaseJsFailureAt` stamps from any supabase-js error path
  (`noteSupabaseJsFailure(context, err)`, `sbjs_failure_recorded`). `doTurnIn`
  consumes it as `sbJsRecentlyBad = now - lastSupabaseJsFailureAt < 5min` and ORs it
  into `looksStale` and `useRawForCheckIn` (attempt 0 bypasses the wedged client);
  emits `turn_in_raw_fetch_engaged_proactively`.
- The `doTurnIn` catch treats any `/timed?\s*out/i` as always-retryable (belt and
  suspenders); retry event carries `viaTimedOutCatch:true`.
- `recreateSupabaseClient` skip paths emit `client_recycle_skipped_inflight` /
  `client_recycle_skipped_cooldown`.
- `noteAutoSaveOutcome` recycle gate lowered to fire from `failures >= 3` (per-level
  dedupe), `trigger` `'failure_threshold_early'` at 3-4 / `'failure_threshold'` at >=5;
  `CLIENT_RECYCLE_COOLDOWN_MS = 30000` prevents storms.
- `inFlightAutoSavePromise` created at `performAutoSave` entry; `doTurnIn` bounded
  `Promise.race([inFlightAutoSavePromise, sleep(3000)])` between the optional
  pre-checkin save and `release_lock` so a concurrent autosave finishes (or times
  out) before `check_in_project` competes for the same socket
  (`turn_in_await_inflight_autosave`).
- `CHECK_IN_TIMEOUT_MS` raised 8000 -> 10000 ms.
- Localhost-only `IS_DEV_HOST` block adds `console.assert` self-tests for
  `isTransientSaveError` so the regex regression cannot reappear silently.

### PR 13 — Large-PDF upload: size-aware, abortable, verify-backed (Phase C)

- Root cause from a user's exported save logs (cross-referenced with the
  project's Supabase storage logs): a ~24 MB first-PDF upload hit the fixed 60s
  `withTimeout` on `supabase.storage.from('pdfs').upload(...)`, the once-only
  retry doubled it (~140s), and Turn In blocked on `turn_in_blocked_by_save_err`
  — yet the storage logs showed the object actually landing ~4.5 min later (a
  request the client had already abandoned, since the old timeout passed a plain
  promise and never aborted, so retries could stack a second concurrent upload).
- `pdfUploadTimeoutMs(bytes, opts)` (pure, in [save-utils.js](save-utils.js))
  sizes the upload timeout from the byte count at an assumed conservative uplink
  (`PDF_UPLOAD_ASSUMED_BPS`), floored at `PDF_UPLOAD_TIMEOUT_BASE_MS` (60s) and
  clamped to `PDF_UPLOAD_TIMEOUT_MAX_MS` (8 min). 24 MB now budgets ~4.3 min.
- storage-js `upload()` does not accept an `AbortSignal` (only `list`/`download`
  take `FetchParameters`), so the standard path cannot cancel an in-flight
  request; the size-aware timeout only bounds how long the client *waits*, and
  `confirmPdfUploaded` reconciles a request that completed server-side after the
  wait. Genuine cancellation (and resume) for large PDFs comes from the
  resumable/TUS path in PR 14, not from the standard upload.
- `uploadPdfToStorage()` wraps the upload with a **verify-after-timeout** safety
  net: on a transient failure it polls `confirmPdfUploaded()` (storage `.info()`,
  `PDF_UPLOAD_VERIFY_ATTEMPTS` × `PDF_UPLOAD_VERIFY_GAP_MS`) and, if the object
  is present with the expected byte size, treats the save as succeeded (computing
  `pdf_hash` from the local buffer) rather than re-uploading. Emits
  `pdf_upload_verified_after_timeout`.
- Autosave throttling: `uploadLocalPdfToCloudIfNeeded('autosave_tick')` keeps
  uploading large first-PDFs in the background (so a PDF opened via "Open" without
  an explicit Save/Turn In still reaches the cloud), but a *failed* large upload
  now backs off `PDF_ONESHOT_LARGE_BACKOFF_MS` (5 min) instead of 30s. Combined
  with the `pdfOneShotUploadInFlight` guard (no overlapping ticks), the resumable
  path (PR 14, resumes rather than restarts), and the size-aware timeout, this
  removes the tight 5s retry loop that stranded William's 24 MB PDF without
  stranding the PDF for autosave-only sessions.
- New unit coverage: `pdfUploadTimeoutMs` (save-utils.test.js) + the timeout-budget
  invariants (constants.test.js).

### PR 14 — Resumable (TUS) PDF upload + progress + cross-reload resume (Phase D)

- Large PDFs (`> PDF_RESUMABLE_THRESHOLD_BYTES`, default 8 MB) now upload via the
  resumable/TUS protocol against Supabase Storage's
  `/storage/v1/upload/resumable` endpoint (chunked at the required 6 MB), instead
  of a single PUT. `tus-js-client` is loaded via CDN ([index.html](index.html));
  smaller PDFs keep the Phase C standard path.
- `uploadPdfResumable(storagePath, blob, { fingerprint, onProgress, signal })`
  wraps `tus.Upload` with `authorization`/`apikey`/`x-upsert` headers and
  `bucketName`/`objectName`/`contentType` metadata; `uploadPdfToStorage()` routes
  by size and still runs the `confirmPdfUploaded()` verify net on any failure.
- Determinate progress: byte progress flows through a module-level
  `onPdfUploadProgress` sink into the manual-save status line ("Uploading PDF…
  NN%") and the Turn In banner, fixing the "feels stuck" perception on slow links.
- Cross-reload resume: an interrupted upload resumes from the last acked chunk
  after a page reload. tus's `UrlStorage` is backed by a new IndexedDB store
  `pdf_upload_resume` (DB `clickcount-pdf-cache` bumped v5 -> v6, now 9 stores;
  helpers `idbPdfUploadResume*` in [idb.js](idb.js)), keyed by a
  project-id + content-hash fingerprint so a resume never attaches to a stale
  partial upload of different PDF content; entries are cleared on success.
- New coverage: the `pdf_upload_resume` store round-trip ([idb.test.js](idb.test.js))
  and a non-cloud Playwright smoke ([pdf-upload.spec.js](pdf-upload.spec.js))
  asserting the tus CDN library loads and the resume store round-trips in a real
  browser. The large-file resumable upload itself needs a signed-in cloud session
  + slow link, so it stays a manual smoke.

---

## Other notable historical detail

- **Checkout server time / clock skew** — `check_out_project` and
  `refresh_checkout_activity` return `server_now` + `checked_out_at` (migration 038);
  the client tracks `serverClockOffsetMs` via `updateServerClockFromRpc` and uses
  `serverNowMs()` for all expiry math, so client clock skew never produces false
  "edit session expired" toasts. Migration 040 extends `check_in_project` /
  `force_check_in_project` to return `server_now` too. Migration 039 adds a BEFORE
  UPDATE trigger so `projects.updated_at` is server-set, removing multi-tab staleness
  races against IDB backups.
- **Checkout realtime channel** — `subscribeToProjectCheckoutChanges` is async, gates
  every callback on a captured `projectsCheckoutGeneration` token (rapid project
  switches cannot leak channels), uses capped backoff reconnect
  (`PROJECTS_CHECKOUT_RECONNECT_BACKOFF_MS` = 1s/3s/10s/30s), and forces one
  `refreshProjectPermissions` on `SUBSCRIBED`.
- **Save Status verbose mode** — `localStorage.clickcount-debug-save` (via
  `setSaveDebugEnabled`) tees `saveDebugLog` into `saveStatusLog` as kind `debug`
  (4 KB cap) and extends the rolling window from 5 to 60 minutes.
- **Save Status diagnostic enrichment** — the export envelope
  (`buildSaveLogsEnvelope`, still schema `clickcount-save-logs/v1` — additive) gained
  fields to make user-reported save/sync errors root-causable: `tabSessionId`;
  `timing.sessionExpiresAt`/`secondsToExpiry` (JWT-expiry class on long-open tabs);
  `timing.clientRecycles`/`autosaveLatencyP50`/`P95`/`autosaveLatencyN`/`degradedForMs`/
  `nextAutoSaveAttemptInMs` (surfacing already-computed degradation); `project`
  checkout ownership (`checkedOutBy`/`Email`/`At`/`AgoMs`, `canCheckOut`,
  `projectOwnerId`, `loadedViaViewLink`) and payload sizing
  (`dataJsonBytes`/`pdfBufferBytes`/`nearPdfCap`, computed export-time only);
  `storage` (`navigator.storage.estimate`) + `lastLocalBackup` `{at, ok}`; and
  `visibility` on autosave events. Failed raw-fetch saves attach server
  request-correlation IDs (`serializeSaveError`'s pure sibling
  `extractResponseDiagnostics` -> `requestId`/`cfRay`/`retryAfter`/`serverDate`) at
  `rawProjectsUpdate`/`rawProjectsInsert`/`rawCheckInProject` + the recovery probe.
  Caveat: those response headers are only readable when Supabase sends
  `Access-Control-Expose-Headers` for them, so `requestId` can be null even when one
  exists server-side. Every serialized error now carries a `transient` triage flag
  (`isTransientSaveError`). New pure helpers `extractResponseDiagnostics` /
  `secondsToExpiry` live in `save-utils.js` (unit-tested).
- **Manual-save PDF-mismatch guard** — Save Project modal blocks at a confirm when
  `!includePdf && state.pdfHash !== projects.pdf_hash` (`manual_save_canceled` /
  `manual_save_pdf_mismatch_accepted`), preventing saving new-PDF annotations against
  the old cloud PDF. `performSaveProjectToCloud` best-effort removes the previous
  storage object after a successful PDF replacement (`manual.save.pdf_cleanup_ok` /
  `_err`).
- **Prepare PDF append mode** — `openPreparePdfModal(..., {mode:'append'})` merges the
  trimmed buffer onto `state.pdfBuffer`, appends pages, re-binds `pdfPage` refs to the
  merged document, enforces the 50MB ceiling, and resets `pdfStoragePath` / `pdfHash`
  so the next save re-uploads.

---

## Modularization

A long-running effort to make the codebase more navigable by decomposing the one
monolithic `app.js` IIFE without a build step (the app stays vanilla
HTML/CSS/JS, classic `<script src>` only). `app.js` went from ~16.2k to ~13.7k
lines via two complementary techniques. *Current* structure lives in
[AGENTS.md](AGENTS.md) ("Tech constraints" / "`window.App` registry") and
[ARCHITECTURE.md](ARCHITECTURE.md) ("Files" / "Feature files"); this section is
the history and the rationale behind the patterns.

### Pure-module extraction

Self-contained math/data/format/storage helpers (no `state` / DOM / `window`
dependency) were lifted into standalone classic scripts loaded **before**
`app.js`, each ending in a guarded CommonJS export footer (inert in the browser,
`require()`-able in Node) so a sibling `*.test.js` can unit-test it under
`node --test`. Where a helper needed `state`-derived values, the pure function
took them as arguments and `app.js` kept a same-named **thin wrapper** that
resolves the value and delegates — so call sites (and the `report.js` `window.*`
contract) never changed.

- [geometry.js](geometry.js) — pure math/geometry/parse primitives (`ptDist`,
  `polylineDistance`, `polygonArea`, `distToSegment`, bezier helpers,
  `rotatePoint90CW`, zone locators, `parseRealWorldLength`, `formatAgo`, …).
- [constants.js](constants.js) — module-level constant literals (`TOOL`,
  `SCALE_MODES`, `PLUMBING_DEFAULTS`, `LINE_DEFAULTS`, `COLORS`, `SCALE_PRESETS`,
  the autosave/checkout timing & threshold block, IndexedDB store names + caps,
  Save Status log windows, …).
- [idb.js](idb.js) — the IndexedDB storage layer (`openPdfCacheDb` + the
  context-free `viewCache*` / `pdfCache*` / `takeoffBackup*` / save-logs
  accessors + pure primitives); `app.js` keeps the state/logging-coupled
  `takeoffBackupGet/Put`, `writeSaveLogsSnapshots`, `customIcons*` wrappers.
  Unit-tested with the `fake-indexeddb` devDependency.
- [format.js](format.js) — pure date/time/text formatters for the User Activity
  UI (`formatLastSignIn`, `dateKeyInTimeZone`, `filterUserActivityRows`,
  `renderUserActivityAllUsersTableHtml`, …); the DOM-coupled
  `applyUserActivityFilter` / `populateUserActivityUserSelect` stay in `app.js`.
- [icon-render.js](icon-render.js) — pure icon geometry / render-rule helpers
  (`CUSTOM_ICON_META`, `iconMetaFromList`, `iconViewBoxFromList`,
  `iconRenderVbRule`, `iconSvgHtml`, …); the user-icon-cache-coupled
  `getCustomIconMeta`, `renderIconHtml`, … stay in `app.js` as wrappers that
  inject `getEffectiveCustomIcons()`. Loaded after [icons.js](icons.js).
- [line-metrics.js](line-metrics.js) — pure line length/geometry helpers mined
  from the line-totals region (`getLineGeomPdfPts` and friends), taking
  scale/zone inputs as arguments; `app.js` keeps the `window.*` wrappers
  (`quickLineLength`, `getLineLengthForTotals`, …) consumed by `report.js`.
- [save-utils.js](save-utils.js) — pure save/sync helpers. Started as
  `isTransientSaveError` / `getProjectCounts`; later expanded with
  `serializeSaveError`, `formatSaveStatusErrDetail`, `backoffDelayMs`,
  `computeClockOffsetMs`, and `percentile`, consolidating error-serialization and
  timing math that had been inline in the sync-hardening code.

ESLint's flat config grew per-module global groups so each pure module sees only
its own dependencies' exports as `readonly` (avoiding `no-redeclare`), and the
`app.js` group auto-derives the sibling modules' exports as `readonly` globals.

### `window.App` registry (feature-file splits)

`app.js` is one big IIFE, so code moved to a separate `<script>` can't see its
closure-locals by bare name. The bridge is a `window.App` registry: `app.js`
publishes the shared surface near its tail (`App.state = state;
App.renderPdf = renderPdf; …`), and each `features/<name>.js` is its own IIFE
that reads deps from `App.*` **at call time** and registers its public entry
points back onto `App`. Call sites in `app.js` use deferred arrows
(`() => App.fn()`) so they never capture a binding before the feature file
loads. Feature files load **after** `app.js` and **before** `report.js`.

Patterns that emerged as the harder modals moved out:

- **Publish-only deps** — a helper used widely in `app.js` stays defined there
  and is merely exposed on `App` (only the feature's *own* functions relocate).
- **Getter-accessor** — for engine-owned `let`s that get reassigned
  (`saveStatusLog`, `checkoutExpiredNeedsAttention`, `supabase`), publish a
  getter (`App.getX = () => x;`) so features always read the live value, never a
  stale module-load snapshot.
- **Deferred wrapper** — sloppy-mode hoisted block-scoped functions assigned at
  runtime (e.g. `resetAutoRecheckoutCounter`) are published as
  `App.fn = (...a) => fn(...a)` to defer lookup to call time.
- **Bidirectional / callback registration** — when a moved modal and `app.js`
  call each other, both sides register on `App` (or the feature exposes a
  callback like `App.onGroupModalHidden`).

The 33 feature files in load order, each with a `*.spec.js` Playwright
regression (cloud-gated specs `test.skip` when Supabase secrets are absent).
All but [features/zoom-rail.js](features/zoom-rail.js) are extractions from
app.js; the Zoom Rail was born as a feature file (a new feature built directly
on the registry). Note the "pilot #N" split numbering used in
AGENTS/ARCHITECTURE is **chronological by extraction**, not this load order —
zoom-rail loads 4th but arrived much later:

1. [features/canvas-repair.js](features/canvas-repair.js) — Canvas Repair modal
   (first split; introduced the registry).
2. [features/note.js](features/note.js) — Note add/edit modal.
3. [features/zoom.js](features/zoom.js) — Zoom Settings modal.
4. [features/zoom-rail.js](features/zoom-rail.js) — the Zoom Rail (right-edge
   vertical zoom slider; not an extraction — built registry-native).
5. [features/manage-icons.js](features/manage-icons.js) — Manage Icons modal
   (first multi-region move).
6. [features/multiply-zone-settings.js](features/multiply-zone-settings.js) —
   Multiply Zone settings modal.
7. [features/export-pdfs.js](features/export-pdfs.js) — Export PDFs modal's
   `specificPages*` cluster (largest single move; 9 publish-only deps).
8. [features/legend-settings.js](features/legend-settings.js) — Summary Legend
   settings modal.
9. [features/page-settings.js](features/page-settings.js) — Page settings modal.
10. [features/counter-settings.js](features/counter-settings.js) — Counter
    settings modal (first two-region consolidation).
11. [features/line-type-settings.js](features/line-type-settings.js) — Line Type
    settings modal.
12. [features/choose-create-line-type.js](features/choose-create-line-type.js) —
    Choose/Create Line Type modal.
13. [features/scale.js](features/scale.js) — Set Scale modal (per-page / zone
    scale).
14. [features/groups.js](features/groups.js) — Group + Group Assign modals
    (bidirectional callback for modal-hidden).
15. [features/grid.js](features/grid.js) — Grid overlay toggle + settings.
16. [features/quick-line.js](features/quick-line.js) — Quick Line modal +
    line-modifier preview.
17. [features/counter.js](features/counter.js) — Counter modal (Choose/Create/
    Icon tabs).
18. [features/save-status.js](features/save-status.js) — Save Status modal UI
    (getter-accessor + deferred-wrapper patterns).
19. [features/manage-projects.js](features/manage-projects.js) — Manage Projects
    admin modal (Supabase-gated).
20. [features/user-admin.js](features/user-admin.js) — Manage-Users admin modals
    (create/delete user, all-users; Supabase-gated).
21. [features/load-project.js](features/load-project.js) — cloud Load Project
    modal (most dependency-heavy split; ~20 `App.*` deps + four setters).
22. [features/prepare-pdf.js](features/prepare-pdf.js) — Prepare PDF modal
    (page keep/drop, rotate, append mode).
23. [features/quick-modals.js](features/quick-modals.js) — Quick Plumbing +
    Quick Count modifier-driven create panels.
24. [features/pdf-bundle.js](features/pdf-bundle.js) — PDF-bundling helpers
    (report/notes/highlights → jsPDF; re-homed already-registered `App.*`
    entries).
25. [features/item-details.js](features/item-details.js) — Counter/Line Type
    details modal + Line Properties modal + `deleteGroup` (re-homed
    `App.deleteGroup`; first feature-registered getter,
    `App.getCounterLineTypeDetailsItem`).
26. [features/output.js](features/output.js) — output-actions cluster: Copy to
    PipeTooling (+ export view-link cache), Copy Summary, Download current
    page (first split registering no entry points — bindings move with their
    DOM elements; one callback, `App.onViewLinkRevoked`).
27. [features/share-links.js](features/share-links.js) — Share Project modal:
    people list + view links (Supabase-gated; revoke reaches output.js's
    cache-clear via `App.onViewLinkRevoked` — feature-to-feature registry
    coupling; zero new published deps).
28. [features/import-clear.js](features/import-clear.js) — canvas JSON import
    (+ import-after-PDF prompt) and the Clear Page confirm flow (new
    publish-only deps `applyPageAnnotationsFromData`/`getActiveCanvas`; the
    custom-icon upload handler stays in app.js).
29. [features/zone-modals.js](features/zone-modals.js) — Multiply Zone value
    modal + Delete Zone confirm + Delete Page confirm handlers (no entry
    points; pending state rides on `state`; one publish-only dep,
    `performDeleteZone`).
30. [features/burger-menu.js](features/burger-menu.js) — mobile burger drawer
    + desktop header-overflow compact mode (zero new deps; `updateUI` calls
    `App.updateBurgerMenu`/`App.scheduleHeaderCollapseCheck` defensively;
    covered by the pre-existing mobile-burger-menu + header-overflow specs).
31. [features/canvas-layers.js](features/canvas-layers.js) — add / details /
    delete-canvas modals + footer layers menu + show-all-canvases peek (one
    publish-only dep `deepCopyAnnotations`; the Escape rename-commit reuses
    the Done button via a dispatched click; canvas JSON export stays).
32. [features/my-settings.js](features/my-settings.js) — My Settings modal:
    opener + Artboard save/load/export/clear + password form + sign-out +
    admin openers (new publishes `fetchUserAirboard`/`saveUserAirboard`/
    `PLUMBING_DEFAULTS`/`LINE_DEFAULTS`; the Airboard engine and auth
    sign-in form stay in app.js).
33. [features/user-activity.js](features/user-activity.js) — admin User
    Activity modal: raw event log + all-users/summary loaders + user-select
    + client-side filter (`App.openUserActivityModal` registration re-homed;
    three format.js helper publishes; user-admin.js keeps consuming it).

### Tooling

`npm run check` (lint + `test:unit` + `build:toc --check`) runs on every push/PR
via [.github/workflows/ci.yml](.github/workflows/ci.yml) (Node 20; Playwright is
excluded since it needs a server + Supabase/dev-auth secrets). The
[ARCHITECTURE.md](ARCHITECTURE.md) section index is regenerated from the
`// SECTION:` markers by `npm run build:toc`
([scripts/build-toc.js](scripts/build-toc.js)); section markers were renamed or
removed as their code emptied out into feature files.

## Manage Users — admin toolkit + self-service activity

A batch of admin user-management features built on top of the
[features/user-admin.js](features/user-admin.js) split. All client work is in
`features/user-admin.js` + `index.html` + `styles.css`; cloud pieces are Edge
Functions and RPCs. Live-verified (incl. a no-leak security check on each RPC/Edge
Function) and shipped via PRs #2–#9.

### Table & layout
- Manage Users / All Users became a real table: a sticky **header row**, a stacked
  **last-sign-in / last-active** column (one column, two lines), and an owned-
  **Projects** count column. `list_users_for_admin()` gained `project_count`
  (migration `…_list_users_for_admin_project_count`). The Manage Users modal was
  widened (`#manageUserModal .modal-card` → 780px) and the per-row action icons
  (Set Password / Transfer / activity) tightened into a button group (negative
  margins mirrored onto the header spacers to keep columns aligned).

### Reassign / Transfer ownership
- `supabase/functions/_shared/reassignProjects.ts` — the shared engine: for every
  project owned by `fromUserId`, **move the owner-scoped PDF storage object**
  (`{ownerId}/{projectId}/document.pdf`) and update `projects.user_id` + `pdf_path`,
  then reassign inherited view links (`project_view_links.created_by`, scoped to
  moved projects) and delete now-redundant share rows. Storage-move-then-DB
  ordering + idempotent retry; throws to abort so a user is **never deleted on
  partial failure**.
- `admin-delete-user` gained an optional `reassignToUserId` (reassign before delete;
  delete-only path unchanged when omitted). `admin-reassign-projects` is a new
  standalone **Transfer ownership** function. Client: a delete dialog
  (`#deleteUserConfirmModal`, delete-projects vs reassign) and a per-row Transfer
  dialog (`#transferProjectsModal`).

### Set password
- `admin-set-password` Edge Function (`updateUserById({ password })`, admin-gated,
  min 6). Per-row key icon → `#setPasswordModal`.

### Projects modal
- Clicking a user's Projects count opens `#userProjectsModal` (name + last-edited),
  filtered client-side from the existing `list_projects_for_admin` RPC.

### Activity overview + My Activity
- `user_activity_detail_for_admin(uuid)` RPC — one security-definer call returns a
  jsonb with identity/presence, all-time totals, per-event-type breakdown, rolling
  1d/7d/30d windows, active-days (CST), distinct projects, and a recent timeline
  with resolved project names. A `guard` CTE is the single auth choke point;
  relaxed to **self-or-admin** (a non-admin can read only their own — verified no
  leak), recent feed widened 40 → 200.
- `#userActivityOverviewModal` (`openUserActivityOverview`): summary card + stat
  tiles + a **day-grouped, run-collapsed** Recent-activity feed (consecutive
  identical actions merged into counted rows with a time range, e.g. "Placed 22
  counters · Lobby · 1:56–2:17 PM", under Today/Yesterday/date headers; sign-ins
  quieted). Opened from a row's stacked dates cell or heart icon, and — for the
  signed-in user — from **My Activity** in User Settings (`#mySettingsMyActivity`).
  `app.js` publishes `App.formatUserActivityDateTime` for the feed.

## Copy to /Tooling — embedded view link

The **Copy to PipeTooling** export (`doCopyPipeTooling`) appends the project's
**view link** as a trailing `View link:\t<url>` footer after the tab-delimited
count rows, so importing tools (PipeTooling / TakeoffTooling) can link the pasted
bid back to the source takeoff. Importers detect it by scanning the paste for a
counttooling `?t=<token>` URL — format-agnostic, so the label/placement can change
without breaking the contract.

- **Shared link helper** — extracted `getOrCreateViewLinkUrl()` (reuse the
  project's newest `list_view_links` token, else `create_view_link`) +
  `buildViewLinkUrl(token)` (`origin + path + ?t=token`) out of the header Share
  button. `copyOrCreateViewLinkToClipboard` now calls them, and the export reuses
  the same path — a project's link is shared, not minted fresh per export.
- **Gesture-safe clipboard** — `navigator.clipboard.writeText` needs transient
  user activation, which an `await` before the write can forfeit on Safari/Firefox.
  `prefetchExportViewLink()` runs when the `#forPipeTooling` dropdown opens (itself
  a gesture), caching the URL per `currentProjectId` so the option-click write
  stays synchronous. An inline `await` is the fallback if the prefetch hasn't
  resolved yet.
- **No-link cases** — when no link is possible the counts still copy and a context
  toast explains why: project not saved to cloud, signed out, or opened via a view
  link (view-only sessions can't mint a share link). The whole block is gated on
  `SUPABASE_ENABLED`, so the non-cloud build stays silent.
- **Cache hygiene** — revoking a view link in the Share modal clears the export
  prefetch cache (`exportViewLinkUrl` / `exportViewLinkProjectId`) so a stale,
  revoked token is never handed out; the per-project key also guards against
  carrying a link across a project switch.
- **Importer side** (PipeTooling / TakeoffTooling, separate repos) must detect +
  store the URL and strip the footer line; until then a not-yet-updated grid shows
  one stray trailing row.

## Hide marks — bare-drawing toggle

A header **eye toggle** (`#hideMarksBtn`) lets anyone peel the takeoff overlay off
the drawing and bring it back — built for view-link recipients reading plans on a
phone, but available to editors too.

- All marks (counters, lines, polylines, highlights, notes, the summary legend)
  render onto a single overlay canvas (`annCanvas`) layered over the PDF canvas —
  no DOM mark layers — so hiding is one cheap operation. `toggleHideMarks` flips
  `state.hideMarks`; `renderAnnotations` sizes + clears the overlay then
  **early-returns** when the flag is set, leaving the bare PDF visible. Toggling
  back repaints in full. It's **purely visual** — the annotation data is never
  touched, and exports/reports draw through `renderAnnotationsToContext`, so
  they're unaffected.
- The button sits in the top header next to Share, **shown to everyone** once a PDF
  is loaded (not `supabase-only`, not viewer-gated). Tap to toggle; the icon swaps
  **eye ⇄ eye-slash** and the button takes an `.active` state via
  `updateHideMarksButton` (called from `updateUI`); `aria-pressed` + title
  ("Hide marks" / "Show marks") track state.
- **Persistence:** the flag survives page/sheet changes and zoom automatically
  (every render checks it). For **view-link sessions** it also survives reloads —
  `state.viewToken` is captured in `initViewOnlyMode`, the preference is restored
  from `localStorage` (`view:hideMarks:<token>`) before the first paint, and saved
  on each toggle. Editor (non-view) sessions are session-only, defaulting to shown.
- **Regression test** — [hide-marks.spec.js](hide-marks.spec.js): loads a 2-page PDF,
  injects a counter with 5 markers, and asserts at the **pixel level** that the
  `#annCanvas` overlay is painted when shown and fully transparent when hidden, plus
  the eye ⇄ eye-slash icon swap, aria/title state, that the marker data survives the
  toggle, and that the hidden state persists across page navigation.

## Mobile right-side burger menu

On mobile the header was crowded with icon buttons. When a PDF is loaded on a phone
(`@media (max-width: 768px)`), four secondary header controls — **Hide marks**,
**Share**, **Download current page**, **Export project** — are now folded into a new
**right-side slide-in drawer** (`#headerBurger`), decluttering the header. Desktop is
unchanged.

- **Drawer mechanics mirror the left sidebar** — `#headerBurger` toggles
  `body.right-menu-open`; `#rightMenu` slides in from the right (`transform:
  translateX(100%)→0`) over a `#rightMenuBackdrop`, structurally cloned from the
  existing `#hamburger`/`#sidebarBackdrop`/`.sidebar` pattern. Burger visibility is
  **pure CSS** gated on the existing `body.has-pdf` class inside the mobile media
  query — no new JS show/hide.
- **Rows reuse desktop logic, no duplication** — `updateBurgerMenu()` (called at the
  end of `updateUI()`, after the option-visibility block) rebuilds `#rightMenuList`
  from the **currently-visible** `.download-page-option` / `.export-dropdown-option`
  buttons (whose `style.display` updateUI already computes), so the flattened list
  matches desktop exactly — including the single-page "smart" collapse (only the
  `this-canvas` download option is visible → one Download row) and the export gating.
  Each row **dispatches the original (CSS-hidden) control's click**: Download/Export
  options → their own `.click()`; Marks → `#hideMarksBtn`; Share → `#sidebarLogoShare`
  (editor → Share modal) or `#headerShareBtn` (signed-in view-link viewer → copy link).
  Each row also **clones its source control's `<svg>`** (eye / yellow printer / export
  glyph) into a leading icon (sized via `.right-menu-icon`), so the drawer is visually
  scannable and matches the header — no duplicated icon data.
  Dispatching clicks (rather than calling the functions) also sidesteps a scope split
  — `openShareProjectModal` lives in a deeper closure than `updateUI`.
- **Hiding the originals** — the four header controls carry a shared
  `consolidated-mobile` class; `body.has-pdf .header .consolidated-mobile { display:none
  !important }` (in the mobile media query) suppresses them on mobile, the `!important`
  overriding the inline `style.display` updateUI writes (and the now-redundant
  `#headerShareBtn.in-view-mode` rule). The DOM elements stay put — only their header
  rendering is hidden — so updateUI's logic and the drawer's row-building still read them.
- **Regression test** — [mobile-burger-menu.spec.js](mobile-burger-menu.spec.js) at a
  390px viewport: burger gated on a loaded PDF; the four controls hidden; expected rows
  + sections; the Marks row flips `state.hideMarks` and closes the drawer; the label
  reflects state on reopen; backdrop closes it; a single-page PDF collapses Download to
  one row; and a desktop-viewport case asserting the burger stays hidden and the header
  dropdowns stay visible.

### Desktop header overflow → compact mode

The same consolidation now also kicks in on **desktop** when the header is too narrow
to fit everything. Previously, below ~1080px the right-side header icons (eye / export /
download, widened further by the new eye button) were pushed past the right edge with
`overflow-x: visible` and **no way to scroll to them** — they were simply unreachable.

- **Overflow detection, oscillation-free** — `updateHeaderCollapsed()` runs on `resize`
  (rAF-throttled) and from `updateUI`. It measures the header in its **expanded** state
  — removes `body.header-collapsed`, reads `header.scrollWidth > header.clientWidth`,
  then re-adds the class if overflowing (all synchronous, so no flicker). Because the
  decision is always made against the *expanded* natural width, collapsing can't change
  the input and the toggle never oscillates at the boundary. On mobile (≤768px) it's a
  no-op — the media query still drives mobile.
- **Full compact layout** — CSS gated on `body.header-collapsed` makes `.header-tools-scroll`
  horizontally scrollable + collapses the spacer (so the left tools scroll instead of
  pushing the right cluster off), hides the `consolidated-mobile` right actions, shows
  `#headerBurger`, and enables the **same right slide-in drawer** as mobile. Settings /
  save-status stay visible as icons (and are also reachable via the desktop sidebar /
  status bar), so nothing is lost. The rules are duplicated from (not shared with) the
  mobile media query so mobile stays pure-CSS and unaffected.
- **Regression test** — [header-overflow.spec.js](header-overflow.spec.js): at 820px
  (desktop, narrow) the header collapses, the burger is visible **within** the viewport
  (not cut off), the right PDF icons are hidden, and the drawer opens with the actions;
  at 1400px it stays normal (no burger, dropdowns visible); and resizing wide↔narrow
  toggles it both ways.

## PWA / offline support

Made the app an installable PWA that works **fully offline for an already-loaded
takeoff** — built for estimators on phones in the field. The data layer was already
offline-tolerant (IndexedDB PDF cache + takeoff backups, hardened sync); the gap was that
the shell/JS/CSS/font/lib assets weren't cached and the runtime libs came from CDNs. This
was almost entirely an asset/caching/packaging change — no offline app logic. Shipped in
phases.

- **Phase 1 — self-host libs + fonts.** Vendored the six runtime libraries (pdf.js +
  worker, pdf-lib, html2canvas, jsPDF, supabase-js `2.108.0`, tus `4.3.1`) and the Google
  Fonts (DM Sans/Mono, Instrument Serif) under `vendor/` / `vendor/fonts/` with
  version-pinned filenames, and pointed the app at them. **The pdf.js `workerSrc` (app.js
  top) was repointed to the local worker** — it's fetched lazily on first render, so this
  is what makes offline (and large-PDF) rendering work. Now everything except Supabase is
  same-origin. `eslint.config.js` ignores `vendor/`.
- **Phase 2 — service worker.** [sw.js](sw.js) precaches the full same-origin shell (66
  assets) under a version-stamped cache (`counttooling-shell-vN`). Two-tier fetch:
  navigations/HTML **network-first** (always boot the freshest shell online; cached HTML
  offline), other same-origin assets **cache-first** so the offline shell is a coherent
  single version (avoids a mixed old/new shell on flaky deploys). Non-GET and cross-origin
  (Supabase REST/auth/realtime/storage **range-requests**/TUS/functions) pass straight to
  the network. `skipWaiting` + `clients.claim`; `activate` purges old versions. Registered
  at the top of `init()` so the view-link path gets it too. A dedicated `sw.js` eslint
  group uses the serviceworker globals.
- **Phase 3 — manifest + icons + meta.** [manifest.webmanifest](manifest.webmanifest)
  (standalone; theme `#17171a`, bg `#0f0f11`; 192/512/maskable icons; clean `start_url`
  that never bakes in `?t=`/`?devAuth=1`). Icons are a yellow takeoff-reticle generated by
  `npm run build:pwa-icons` ([scripts/build-pwa-icons.js](scripts/build-pwa-icons.js))
  using the existing Playwright Chromium — no new deps. Head meta: `apple-touch-icon`,
  `theme-color`, `apple/mobile-web-app-capable`, status-bar-style `black-translucent`
  (which pairs with the existing `--safe-top` header padding to fill the notch).
  `navigator.storage.persist()` is requested after auth so the OS doesn't evict the
  offline corpus.
- **Phase 4 — standalone polish + coordination.** A `--safe-bottom` token + `.status-bar`
  bottom padding clears the iOS home indicator in standalone mode (the bottom half of the
  earlier safe-area work). `doGlobalReloadNow` now also best-effort clears Cache Storage
  (fire-and-forget — must not block the reload); network-first HTML makes this
  non-load-bearing for correctness.
- **Deploy discipline (no build step):** bump `CACHE_VERSION` in [sw.js](sw.js) on every
  deploy that changes a precached asset, or the SW won't detect the update (the admin
  global-force-reload is the backstop). *(Since automated: the manual bump kept being
  forgotten, so `CACHE_VERSION` is now a content hash stamped by `npm run build:sw` and
  checked in `npm run check`.)* GitHub Pages caches `sw.js` ~10 min, so updates
  lag slightly. **iOS:** an installed app has a separate storage partition — sign in + open
  a takeoff once online before offline works.
- **Regression test** — [pwa.spec.js](pwa.spec.js): manifest linked/parseable with
  sized + maskable icons that resolve; head meta present; SW registers and precaches the
  shell (worker/app/HTML); and the headline — warm the SW online, go offline, reload, and
  assert the app boots **and renders a PDF from the cached worker** (no fake-worker
  fallback, no page errors). Local only (Playwright is excluded from CI).

## SEO — Tier 1 technical hygiene

The app had only a `<title>`. It's admin-provisioned (no public signup) and an auth-gated
SPA, so the SEO ceiling is low — the value here is **link-share previews + privacy + clean
indexing**, not lead-gen ranking (a marketing landing page + content would be the real
organic lever; out of scope).

- **Static head tags** ([index.html](index.html), after `<title>`): meta description
  (benefit-forward), `rel=canonical`, full Open Graph + Twitter Card set, and
  `WebApplication` JSON-LD with `sameAs` to the sister sites. All absolute URLs.
- **Privacy noindex** — a tiny inline head script injects `<meta name="robots"
  content="noindex, nofollow">` when the URL carries `?t=` (private view links hold customer
  takeoffs) or `?devAuth=1` (localhost bypass); the clean `/` stays indexable. Crawlers honor
  a JS-injected robots meta, and `robots.txt` deliberately does **not** disallow `?t=` (so the
  crawl reaches the noindex).
- **Branded social card** — `og-image.png` (1200×630): dark brand background, gold reticle
  logo + "CountTooling" wordmark (Instrument Serif), benefit tagline (DM Sans), and a faint
  blueprint/takeoff motif. Generated by `npm run build:og-image`
  ([scripts/build-og-image.js](scripts/build-og-image.js)) via the existing Playwright
  Chromium with the vendored brand fonts base64-embedded — no new deps.
- **`robots.txt` + `sitemap.xml`** at repo root (sitemap = just `/`). These plus the og-image
  are **crawler-only**, so they're left out of the `sw.js` precache (no `CACHE_VERSION` bump).
- **Regression** — [seo.spec.js](seo.spec.js): the tags/JSON-LD/og-image on `/` (indexable),
  and the noindex on `?t=`/`?devAuth=1`. Local only.
- **Follow-up (no code):** verify the domain in Google Search Console + submit the sitemap.

## SEO — Tier 2: relocate app to /app/, marketing landing at / (Phase 1)

Tier 1 was technical hygiene; the real organic lever is indexable content. But `/` was the
auth-gated app (a crawler saw an empty canvas). Phase 1 makes room: the **app moves to
`/app/`** and **`/` becomes a static marketing landing**. (Phase 2 builds out the full
landing + a guides section.) Admin-provisioned, so the landing's CTA is just "Open the app".

- **App relocated** — `index.html` → `app/index.html`; its `<script>`/`<link>` refs switched
  to **root-absolute** (`/config.js`, `/vendor/*`, `/features/*`, `/app.js`, …) so the shared
  assets stay at repo root and only the HTML moved. The app shell is now `noindex` with a
  `/app/` canonical (the landing owns public SEO); pdf.js `workerSrc` was already root-absolute.
- **Service worker scoped to `/app/`** — `register('/sw.js', { scope: '/app/' })`; precache
  `/` + `/index.html` → `/app/` + `/app/index.html`; nav fallback → `/app/index.html`;
  `CACHE_VERSION` `v1`→`v2`. The marketing site at `/` is plain/network-served (lightweight,
  great CWV). Manifest `id`/`start_url`/`scope` → `/app/`, icons root-absolute.
- **Backward-compat** — new view links already target `/app/?t=` (built from `location.pathname`);
  the landing has a blocking head script that forwards old `/?t=` and `/?devAuth=1` to `/app/`,
  plus a one-time unregister of any stale root-scoped service worker.
- **Minimal landing** at `/` (superseded by the Phase 2 generator): branded hero + feature
  list + "Open the app" CTA, carrying the canonical/OG/JSON-LD moved off the app shell.
- **Tests** — the ~17 app specs (and `cloud-test-helpers.js`) `goto('/')`→`goto('/app/')`;
  `pwa.spec.js` asserts the `/app/` scope + new precache paths; `seo.spec.js` now tests the
  landing at `/` and the `?t=`/`?devAuth=1` → `/app/` forwards.
- **Verified:** `npm run check` green; the full local Playwright suite (51 tests) passes; the
  app boots online + offline at `/app/` (SW scope `…/app/`, cache `…-v2`); `/` serves the
  landing; old `/?t=`/`/?devAuth=1` forward to `/app/`.

## SEO — Tier 2: evergreen Help/Guides section at /guides/ (Markdown-authored)

The real organic lever is indexable content. This adds a **Help/Guides section at `/guides/`**
the owner fills with help articles by **writing Markdown and running one build command** — no
per-article HTML/SEO boilerplate, output stays pure static HTML.

- **Authoring** — drop `content/guides/<slug>.md` with front-matter (title, description,
  updated, order, category), run `npm run build:guides`, commit the `.md` + generated files.
  Steps documented in `content/guides/README.md`.
- **Generator** — `scripts/build-guides.js` (mirrors `build-toc.js`): renders each article via
  a shared `layout()`/`head()`/`header()`/`footer()` (static nav/SEO — crawlable), builds the
  `/guides/` index, and regenerates `sitemap.xml`. Output is deterministic (dates from
  front-matter), so the `--check` mode is stable; `npm run check` now runs
  `build:guides -- --check` to fail CI if the committed HTML is stale. Uses **`marked`** (new
  build-time-only devDependency; ESM-only → loaded via dynamic `import()` from the CommonJS
  script). The deployed site stays pure static HTML.
- **Per-page SEO** — each article: unique title/description, self-canonical, OG `article` +
  Twitter (reusing `og-image.png`), and `Article` + `BreadcrumbList` JSON-LD; the index gets
  `CollectionPage` + `BreadcrumbList`. Real internal links (home ↔ guides ↔ app, breadcrumbs).
- **Shared `marketing.css`** — extracted the landing's inline styles into a top-level
  `marketing.css` (brand tokens + base + article **prose** styles) used by both the landing
  and the guides; the landing now links it and gained a **"Guides"** nav + footer link.
- **Seed content** — two real articles (`how-to-do-a-pdf-takeoff`, `plumbing-takeoff`) drafted
  from actual features, as a copy template.
- **Tests** — `guides.test.js` (Node, **in CI**): every generated page has one self-canonical
  + parseable JSON-LD, every internal link resolves, and the sitemap matches the pages.
  `guides.spec.js` (Playwright, local): the index + an article render with correct SEO/JSON-LD
  and working links. Verified: `npm run check` green (105 unit tests); both specs pass; the
  index + article render on-brand and the landing is unchanged after the CSS extraction.

### Guides — annotated screenshots

The text-only guides now carry **generated, annotated screenshots** (reproducible, not
hand-captured). The blocker was the blank sample PDF, so two new committed-artifact generators:

- **`scripts/build-sample-plan.js`** (`npm run build:sample-plan`) renders an inline SVG
  commercial floor plan (rooms, restroom fixtures, doors, dimensions, title block) to
  `samples/sample-plan.pdf` via Playwright `page.pdf()` — a realistic, non-confidential backdrop.
- **`scripts/build-screenshots.js`** (`npm run build:screenshots`) is self-contained (a tiny
  zero-dep static server + Playwright): it drives the real app at `/app/`, loads the sample plan,
  injects a takeoff (counters on each fixture as fractions of the real PDF page size, a measured
  line, a page scale, the legend), opens dialogs, overlays **numbered callout badges + highlight
  boxes anchored to real DOM elements**, and writes `guides/img/*.png` (2× for crispness). Shots
  are declared in a `SHOTS` manifest. Initial set: a plan-with-takeoff hero, a sidebar-tally
  "counting" shot, and annotated **Set Scale** + **Export PDFs** dialogs — wired into the
  matching articles with ①②③ steps.
- Both are manual (browser; PNG pixels aren't deterministic) → **not** in `npm run check`, like
  `build:og-image`. `marketing.css .prose img` frames/centers images; `guides.test.js`
  link-integrity fails CI if an article references a missing image; `guides.spec.js` asserts an
  article's screenshot actually loads. Authoring documented in `content/guides/README.md`.

## Counts vanishing at extreme zoom (canvas-blank guard)

Counter markers disappeared at extreme zoom and reappeared after zooming around — a
render/memory issue, not data loss. At high zoom three large canvases coexist
(`pdfOffscreenCanvas` + `pdfCanvas` + `annCanvas`), each up to the device's probed area cap
(~64M px); under memory pressure the last-allocated one (the annotation overlay) silently
allocates but paints blank. The existing per-single-canvas, boot-probed cap
(`detectMaxCanvasArea`/`clampEffectiveDpr`) didn't account for coexistence or current memory.

- **Free the offscreen after copy** (`pdfOffscreenCanvas.width = height = 0`) — 3 coexisting
  canvases → 2.
- **Budget the area cap** via a shared `renderAreaSafety` knob (starts at 0.5) applied to
  `maxArea` inside `effectiveDpr`; both `renderPdf` and `renderAnnotations` read the same knob,
  so buffer sizes stay consistent.
- **Read-back guard + ratchet:** after sizing/copying `pdfCanvas`, `canvasCornerReadsBack`
  (factored out of the boot probe) checks it actually allocated; on a blank read it ratchets
  `renderAreaSafety` down (bounded, ~3 steps) and re-renders — a silent blank becomes a softer
  but visible render instead of vanished counts, and a `canvas_render_blank` event is logged.
- The Save Status export envelope gained a passive `display` block (`devicePixelRatio`, probed
  `canvasCaps`, `renderAreaSafety`, last-render dims) so an affected user's exported logs reveal
  their environment.
- Tests: `clampEffectiveDpr` area-budget unit cases; `zoom-canvas-cap.spec.js` (overlay matches
  PDF + painted, single-blank ratchet, always-blank termination).

## Takeoff length tallies denominated in decimal feet

Copy to /Tooling showed different line lengths than the Line Types sidebar: both accumulate
per-line lengths in the page's scale unit (ft/in/m/cm/yd) but formatted differently — the
sidebar as feet-inches (`12'-6"`), the export as a decimal in the page unit (`150.00 in` on an
inch-scaled sheet). Fixed structurally: convert each line to feet **before summing** (also fixes
a latent mixed-unit summation bug) and format decimal feet everywhere.

- New pure helpers `formatFeet` (geometry.js), `lineLengthFeetForTotals` (line-metrics.js); app.js
  wrappers `getLineLengthFeetForTotals` (+`window.*` for report.js) and `getLineRealWorldLengthFeet`.
- Converted to decimal feet: Line Types sidebar, Lines list (totals + per-line), Summary panel +
  count-detail modal, footer totals, Multiply/Delete-zone preview modals, embedded PDF legend; and
  report.js Copy to /Tooling, Copy Summary (email/text), printable Report (unit token now constant
  `ft`; the `<unit> of <name>` + decimal export shape is unchanged, so PipeTooling/TakeoffTooling
  importers keep working). On-canvas per-line labels + the Measure ruler keep feet-inches.
- Tests: `formatFeet` + `lineLengthFeetForTotals` unit cases; `copy-tooling-feet.spec.js` asserts
  the three surfaces agree in feet on inch- and foot-scaled pages.

## View-link page/mark rotation misalignment (bake-frame guard + cache revalidation)

A view-link recipient saw the PDF rotated under the marks ("rotated under the canvas"). The
rotation pipeline is self-consistent for identical {PDF, data} (rotation is baked into mark
coordinates by `rotateAnnotations` and restored alongside `page.rotation`; the render always
overrides the PDF's intrinsic `/Rotate`, which the app otherwise never reads), so the corruption
is a mismatch between the frame the marks were baked against and what the viewer reconstructs.
No incident data — this is defense-in-depth that makes the class detectable + non-silent.

- **Bake-frame stamp + verify** (detect → warn → log, never auto-correct): each saved page carries
  `bakeFrame {w,h,intrinsic}` (`computePageBakeFrame`); both deserialize funnels
  (`applyPageAnnotationsFromData`, `applyTakeoffBackupToState`) recompute the frame and, on
  mismatch, `console.warn` + a one-time toast + `page.bakeMismatch`. Pure `bakeFramesMatch` in
  geometry.js; additive + backward-compatible (no stamp → skip; the IDB backup carries a parallel
  `pageBakeFrames` array).
- **Save-before-share:** `copyOrCreateViewLinkToClipboard` flushes dirty state first so a link's
  live cloud data reflects a just-applied rotation.
- **View-cache revalidation:** `initViewOnlyMode` revalidates against the server when online
  (reusing the cached PDF blob by hash; offline falls back to cache) instead of trusting a stale
  snapshot — and fixes a latent bug where the cached blob was reused even when the PDF hash changed.
  Backed by `updated_at` added to the `get-view-project` Edge Function + the view-cache meta.
- **Rotation telemetry** in the Save Status envelope (`pageRotation`/`pageBake`/`bakeMismatchPages`).
- Tests: `rotation-share-roundtrip.spec.js` generates a `/Rotate-90` PDF in-browser, runs
  editor→viewer-reconstruct (incl. a real multi-page case that must not warn), asserts the
  stamp/round-trip/guard; + `bakeFramesMatch` unit cases.

## RFI flags (2026-08-29)

The CountTooling half of PipeTooling's cross-app RFI loop (`docs/RFI_LOOP_PLAN.md` R2):
`RFI:`-prefixed canvas notes are GC questions captured at the ambiguous spot; the new
sidebar **Copy RFI Flags** button exports them (all pages/canvases, tab-delimited,
project-name header) for paste into PipeTooling's RFI queue. `features/rfi-flags.js` +
`rfi-flags.spec.js`; button wired in the Output cluster of `app/index.html`.

## Agent takeoff door: import-takeoff + eval kernel (2026-08-29)

Wave 3 of PipeTooling's estimator-twin pipeline, CT side: `supabase/functions/import-takeoff`
(twin-only, own-project, idempotent-by-name, canvas-only, loud field-naming 400s — contract
in TAKEOFF_IMPORT.md) writes an agent's takeoff.json as a normal reviewable project in the
exact save-engine data shape; `takeoff-eval.js` (+node tests) diffs any takeoff against a
reference — counts per counter name, decimal feet per line-type name (unscaled px kept
separate) — the scoring rail for agent-vs-human comparison.

## Bid basis: the marked-up plans handoff to PipeTooling (2026-09-10)

When a plan set is too rough to bid to, the office bids to its marked-up copy and sends the
marked sheets with the proposal. PipeTooling's Cover Letter opens the project's view link with
`export=bid-basis&ref=<bid>`; `features/bid-basis.js` (pure model in `bid-basis-model.js`) opens
Export PDFs preset to the sheets that carry marks (`bidBasisPageSelections`: counters, runs,
ducts, rooms — highlights and notes alone never select a page), report first, notes at the back,
names the file `bid-basis_<ref>_<project>_<date>_<HHMM>.pdf` (bid first, so a computer search
finds it), and after the download shows the Downloaded card and `postMessage`s a manifest —
file name, sheets, mark totals, the takeoff's last-saved time, and the Canvas JSON snapshot —
to the PipeTooling tab that opened it, targeted at the PipeTooling origins only. A lighter
"loaded" notice goes out as soon as the plan opens so PipeTooling can flag "takeoff changed
since". Export PDFs was refactored on the way: `readSpecificPagesOptionsFromDom()` +
`runSpecificPagesExport(options)` replace the DOM-driven download function, and a new **Only
sheets with marks** bulk button makes the preset's selection repeatable by hand. Regression:
`bid-basis.spec.js` (popup flow end to end) and `bid-basis-model.test.js`. PipeTooling side:
v2.3219 (`bid_plan_basis_exports`, the Cover Letter card, the letter clause).

## Bid basis follow-ups: save picker, lighter render, the grant source (2026-09-10)

Three refinements to the handoff above. **Confirmed file name**: with the File System Access
API (Chrome / Edge) the bid-basis download asks WHERE to save before the render — the click's
user activation would not survive a minutes-long export — writes the PDF to the chosen handle,
and the manifest carries the name the person actually chose (`saveMethod: 'confirmed'`);
Safari / Firefox keep the plain download (`intended`); Cancel saves nothing, toasts, and re-opens
the dialog on the preset (`App.beginBidBasisSave` / `App.finishBidBasisSave` in
features/bid-basis.js, called from export-pdfs.js). **Lighter render**: the preset renders at
3x / 0.85 JPEG (`BID_BASIS_RENDER` in bid-basis-model.js; `readSpecificPagesOptionsFromDom`
now carries `exportScale` / `jpegQuality`, defaults 4 / 0.95 for the plain dialog). **Grant
source**: `_shared/viewGrant.mjs` accepts `via: 'pipetooling-bid-basis'` — PipeTooling's new
`bid-basis-grant` function names the estimator so `get-view-project` skips the email gate and
the access log shows who opened the takeoff (redeploy `get-view-project`). Regression:
`bid-basis.spec.js` (picker confirmed / cancel / refused) and `view-grant.test.js`.
PipeTooling side: v2.3226.

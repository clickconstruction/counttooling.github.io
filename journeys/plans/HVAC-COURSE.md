# The HVAC course: how a restaurant gets its air, on the app

> Plan of record, written 2026-09-21 as the electrical course (ELECTRICAL-COURSE.md) merged. The
> owner: "let's do the electrical and hvac in order asking ourselves along the way, is this the
> best we can do?" Same format as the two before it: the engineer's drawing is the answer key, a
> question is answered with a click, the app's own checks teach where they can.

## What the first two courses settled, and what is different here

- **Same engine, same rules, same doors.** Nine chapters on the tour engine, the lesson kit, the
  on-sheet targets, a question step drawing none, the seam for the spec, a section in the Learn
  menu (`App.courseSections`), the empty-canvas link, Project Settings → Help,
  `/app/?course=hvac`, `/app/?chapter=hvac:<id>`. Its own set of three sheets (`lesson.set`).
- **The app does the most HVAC math of the three trades.** Rooms know their air (a type's CFM per
  square foot, or the engineer's number), a system knows its capacity and its fan's pressure, a
  run knows its gauge and its pounds, its fittings are inferred from its shape, and Bid Check has
  two physics rows, *Fits the roof* and *Static path*, that judge themselves once the deck height
  and the ESP are known. The course is built so every one of those turns from a number into a
  lesson: the section sheet is drawn to scale so the reader measures the plenum and the wrapped
  main before the row says it fits; the static-path row reads the far diffuser's run before the
  reader is told what ESP is.
- **Attached is not the same as counted.** A diffuser counts toward a system's designed air, and
  the static path, only once a run of that system reaches it. Chapter 5 therefore has an *attach*
  step (right-click, [[Attach to nearest run]]) after the main and the kitchen branch, and
  chapter 4's designed-air card says why it reads 0 of 3,000 until then. The seeds that need the
  main (chapters 6, 7, 9) lay it and attach through the same model the tool commits with
  (`layRun` → duct-model's `makeDuctRun`, then `App.reinferDuctFittings`), synchronously, because
  the lesson kit seeds before it switches the page.

## The set (scripts/sample-hvac.js, `npm run build:sample-hvac`)

The same Main St Restaurant, on `restaurantShell`: a diffuser on M-101 sits at a P-101 coordinate.

| Sheet | Carries | Teaches |
|---|---|---|
| **M-101 Mechanical plan** | 24 air devices tagged by the schedule (SD-1 ×11 at 150 CFM, SD-2 ×2 at 100, SD-3 ×4 at 200, RG-1 ×3, EG-1 ×3 at 75, MA-1 at 2,000) with their flex drops dashed; the supply main drawn at width with its size printed where it steps (24×12, 20×12, 16×10, 12×10) and a 2" wrap; the kitchen, back-room, bar and make-up branches; the restroom exhaust; the hood's grease duct drawn darker (GD) from the collar to the curb, sloped, with a cleanout at its elbow; the kitchen's hall wall dotted as 1-hr rated with an FD at each of its two duct penetrations; RTU-1, EF-1, EF-2 and MAU-1 keyed outside the east wall; two thermostats; the air-balance keynotes | reading air, the taps, the step-down, the grease duct as a material, the rated wall |
| **M-501 Schedules** | the equipment schedule (RTU-1 3,000 CFM at 1.0" ESP, EF-1 2,400 for the hood, EF-2 225, MAU-1 2,000, with the interlock note), the diffuser schedule with neck sizes and CFM, the room air schedule (dining 1,200, kitchen 800, hall 100, with the note that supply includes ventilation) | the palette from the schedule, why the kitchen breathes hardest, why the necks differ, the OA row |
| **M-601 Section** | a building section at 1/2" = 1'-0": floor, ceiling, deck; the main with its wrap dimensioned 1'-4" deep in a 3'-0" plenum; the notes on what else hangs there | a scale per sheet, the plenum measured, *Fits the roof* |

## The chapters

| # | id | The questions, answered by a click (or a reveal) | Doing (the app) |
|---|---|---|---|
| 1 | `sheet` | what an M-sheet carries (reveal); which unit moves the most air (click its key: EF-1, not the RTU; the wrong key is told why); which room breathes hardest (highlight its row); why the kitchen (reveal) | scale, prove it, Highlight |
| 2 | `rooms` | what a boxed room says about its air, and where the number comes from (reveal); why the deck height matters (reveal) | box the dining room, the kitchen and the hall with the type and CFM the schedule gives; the deck height |
| 3 | `diffusers` | why the kitchen's diffusers are bigger (reveal: neck velocity) | the palette proposed from M-501's diffuser schedule with the CFM per tag, 24 devices placed by the tag, return and exhaust grilles |
| 4 | `system` | how much of RTU-1 is spoken for, and why a 3,000 CFM unit for 2,650 of diffusers (reveal: M-501's note 2, the rest is future) | RTU-1 as a group with its capacity and ESP, its mark on the roof key |
| 5 | `main` | why the main shrinks (reveal: the air leaves at every tap); the sizes read off the plan (a run traced at the wrong sizes is named) | the Duct tool at 24×12 with 2" wrap, S at each printed step, the kitchen tap, [[Attach to nearest run]] until two strays are left, the Schedule with its inferred elbows, transitions, tap and damper |
| 6 | `plenum` | how deep the wrapped main is (measure 1'-4" on M-601); will it blow (reveal: what ESP is, and the row that already answered) | a section scaled and proved at 1/2", the plenum measured, *Fits the roof* turned auto by the deck height, *Static path* read |
| 7 | `exhaust` | which duct must not be galvanized (trace it with Material set to welded black steel; galvanized is sent to the run menu); why the gauge table does not apply and what the Schedule did, its own row and the Grease duct block with the cleanouts and the listed wrap (reveal); where a duct crosses the rated wall (count a Fire Damper at both; a wall that is not rated is refused with the keynote); why the grease duct would still get none (reveal: NFPA 96); why make-up air (reveal) | the run's material and its own schedule row at 16 ga, the Fire Damper quick type, the restroom exhaust as an exhaust run at 8"ø, the make-up duct at 20×16 and MA-1 counted |
| 8 | `whole` | the whole set by hand or by the button, then the compare card | the reference takeoff by size, the counts, the bid weight, the Schedule copied |
| 9 | `bid` | which manual rows the set already answers (reveal: OA from the room schedule's note, curb and power from the equipment schedule) | tick, the proof view, the hand-off with the pounds |

**The reference** (chapter 8): 26 marks in seven device types; 24×12 32.5 ft, 20×12 11.7, 16×10
50.5 (the main's last span and the kitchen branch), 12×10 10, 12×8 40.5, 10×8 21.5, 20×16 22,
8"ø 27.6, 18"ø welded black steel 10.1, from the same flat geometry the button lays; the bid weight from the Duct Schedule.

## Trade findings from the 2026-09-24 read

A read of every step against the sheet's source and the app's code, after a new estimator got lost
on the tours' Prove the scale (CHANGELOG 2026-09-24). These are the TRADE items: the drawing, the
numbers or the teaching, where someone with the trade should say which side is right before anyone
edits. The app-side stalls from the same read (dead-end steps, hints, steps that pass on their own)
are being fixed separately. Each item names the step and where it lives; nothing here was walked
live, and a code citation marked *from memory* came from the reviewer's recollection, not the
printed code.

- **The 8" diffuser neck "whistles"** (`diffusers:neck` ~381-382): 200 CFM through an 8" neck is
  about 573 fpm, inside the 400-600 fpm band the card itself quotes, and 10" is 367, below it.
  Quote the band the trade uses (300-500?) or drop the number.
- **Exhaust and make-up air on RTU-1** (`exhaust:makeup` ~508-511, chapter 8's `layRun` ~192-198):
  new runs take the active group, RTU-1, and designed air adds supply and exhaust alike, so MA-1's
  2,000 and EG-1's 225 land on RTU-1 (about 4,875 / 3,000 ⚠) and "Systems within capacity" warns,
  against what chapter 4 taught. Decide whether exhaust belongs on a supply unit's capacity, and
  give MAU-1 its own system.
- **The size changes on the main** (`main:trace` ~423): "click the corner, press S" at 20x12 where
  the run is straight, and each size label is printed about 60 px downstream of its change
  (scripts/sample-hvac.js ~99), so a reader clicks at the label and chapter 8's feet by size drift.
- **Counts in the words**: `sheet:what` (~295) says three kinds of duct and four of grille (the
  legend has four and three); `diffusers:rest` (~376) and the chapter's done text say the row reads
  ✓ (the row never draws one; the ⚠ just goes).
- **`exhaust:makeup` opens with "Spiral round in ten-foot sticks…"**, left over from the restroom
  step, on a card about a 20x16 rectangular duct; "the MAU-1 drop" sits on the drawn back-run band
  with no drop symbol.

## Open, and not blocking

- **A trade review** of chapters 2 to 7, the room air schedule's numbers and the diffuser necks
  (HC-REVIEW).
- **Done the same day, at the owner's ask:** the grease duct is a real run with a material (D25: `material` on the duct model, its own schedule row at the code's fixed gauge and the metal's sheet weight, the grease-duct rule; then D26, the cleanouts by the piece and the listed wrap by the square foot as a Grease duct block of the schedule), and the kitchen's hall wall is rated with a fire damper at each of its two penetrations, counted with the new Fire Damper quick type. Chapter 7 grew from four steps to six.
- **Round duct sizes down the exhaust** are one size; a run that steps round sizes would teach
  the round transition.

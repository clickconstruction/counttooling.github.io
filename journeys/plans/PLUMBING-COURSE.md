# The plumbing course: how a restaurant gets its plumbing, on the app

> Plan of record, written 2026-09-21 after the Learn build (LEARN-PLAN.md) landed. The owner's
> ask: "a short tutorial, and a long tutorial where we use the opportunity to coach the user how
> plumbing, electrical and HVAC work, and the rules, and why things are where they are. As much
> a learning opportunity as a demo of how the app works and all its unique features."
> Decisions the same day: **plumbing first; the engineer's drawing is the answer key; the
> drawing may change to give the course better things to teach.**

## What exists, and what this adds

- **The short tutorial exists.** The three five-minute trade tours and the thirteen lessons
  (features/tutorial.js, features/lessons.js) cover every tool. They teach the app.
- **The long tutorial is a course.** One per trade, chapters of lesson length, resumable, ticked
  on the device, on the same engine. Each chapter alternates coaching (what this is, why the
  engineer put it here, which section of the code says so) with doing (the app's tool for it).
  It teaches the trade through the app. LEARN-PLAN's finding stands: a sixty-step tour does not
  get finished, so a course is chapters, never one tour.
- **Only plumbing has an engineered sheet.** P-101 (Main St Restaurant) carries the engineer's
  water and gas. E-101 and M-101 are specified (SAMPLE-PLANS.md §3) and not drawn, so the
  electrical and HVAC courses wait on those sheets. The plumbing course is built first and
  sets the format.

## The teaching mode: the engineer's drawing is the answer key

A coaching step asks before it tells, and the reader answers with a click wherever the sheet
allows. "Which hand sink serves the cook line?" is a doing step whose check passes only on the
sink beside the range, and whose hint says which sink a wrong click was. "Put a note on a
fixture whose waste must never enter the interceptor" passes on a water closet, a lavatory or
the mop sink and tells the reader a hand sink carries grease. "Where must a cleanout be?"
counts the four spots and names the ones still missing, by room. The explanation then opens
the next card. Where nothing on the sheet can be clicked for an answer (what a P-sheet is, why
a loop), the step is a reading step with `reveal`: the answer waits behind **Show the
engineer's answer**, Next lit throughout.

Second round (the owner: "make these updates", 2026-09-21): the first cut had every why-step as
a reveal, which is telling with a delay. The engine gained two things for the rework: `reveal`
itself, and a body that may be a function, rendered live, for the compare card.

## What the drawing gains (P-101, candidateB in scripts/sample-plan-candidates.js)

P-101 has water and gas but no waste or vent, and most of a plumbing plan's "why" is in the
waste. Everything below is ADDED; no existing fixture, wall, run or label moves, so every
coordinate in features/lessons.js and the tours stays true. Plan-space px, 12 px/ft.

| Added | Where | Teaches |
|---|---|---|
| **Sanitary waste** (the legend's SS line, heavy dashed) from the restrooms and the mop room: a 4" building drain under the hall, east out of the wall, down the outside to the sewer | y = 206 from the men's FD to x = 940, then (1060, 206) to (1060, 537) joining the sewer downstream of the interceptor | gravity drainage, slope, the low corner, why restroom waste never enters the interceptor |
| **Grease waste** (a 3" GW line, the same dash, labelled) from every kitchen, dish and bar fixture to the interceptor's inlet | the kitchen work aisle at y = 436, the back rooms and the bar at y = 540, joined at x = 900 and out at (940, 537) | the interceptor, what goes through it and why, the red note made real |
| **Cleanouts** (CO), four | the upstream end of each drain line and the outside turn | IPC 708: at the upstream end, at every change of direction, within reach |
| **Vents through roof** (VTR), two | the wall between the restrooms and the dish/storage wall | every trap has a vent; the roof flashing the bid counts |
| **Backflow preventer** (RPZ) on the water service | just inside the wall on the 2" CW | IPC 608: the city main is protected from the building |
| **Hose bibb** (HB) on the east wall | outside the kitchen exit door, off the 3/4" CW | a fixture the plan shows once and the bid must not miss |
| **General notes** naming the materials and the slope | a notes block under the keynotes | the line type's name carries the material, and the hanger rule reads it |
| **The hot water return** with its own line style (dotted, HWR in the legend) | down the east wall through the pump | the line most bids miss, traceable as its own type |
| **Fixture units on P-501**: WSFU and DFU columns, and a note adding the drainage load to 47 DFU against the 4" sewer's 180 and a 3" sewer's 36 | the schedule sheet | where the sizes came from, visible |
| **P-601, a waste and vent riser** at 1/4", drawn to scale: the stack from the drain to a foot above the roof, a WC, a lavatory and a floor drain with their trap arms dimensioned, the cleanout at the base, riser notes | a fourth sheet in the lesson set | the vertical the plan cannot show, a trap arm against the table, why a stack goes through the roof |

The one dimension string that lied (36'-0" over a 35'-10" wall) now says what the wall measures.

The materials in the note: domestic water Type L copper; waste and vent PVC DWV; gas black
steel. Copper and PVC have rulebook hanger rows; steel does not, and the course says so
honestly (the reader adds their own row).

Both PDFs that carry P-101 are regenerated from the one source: `npm run build:sample-plan-advanced`
(the engineered sample plan) and `npm run build:sample-lessons` (the lesson set, whose first sheet
is P-101). The tours and the hero films run on the design-build plan and are untouched.

## The chapters

The course runs on the lesson set (samples/sample-lessons.pdf: P-101, P-401, P-501), because the
enlarged plan and the fixture schedule are part of reading a plumbing set. Each chapter opens the
sheets fresh and seeds what earlier chapters produced, the way a lesson does, so chapter 4 never
depends on chapter 3 having been taken. Ids are `plumbing:<id>`.

| # | id | The questions, answered by a click (or a reveal) | Doing (the app) |
|---|---|---|---|
| 1 | `sheet` | what a P-sheet is (reveal); find the fixture the eye skips (count the HB); which row drains the most (highlight WC-1); why a 4" sewer (reveal, from the DFU note) | set the scale, prove it on the 31'-8" string, turn P-501 |
| 2 | `fixtures` | how much wall carries both restrooms (measure WC to WC); which hand sink serves the cook line (click it); which fixtures drain to a floor sink (click both); what TYP. on the FD keynote costs (a Trap primer child count) | counters from the schedule reader, every fixture counted with hints by room, Quick Keys |
| 3 | `water` | the first thing the service meets (count the RPZ); why the trunk climbs the west walls (reveal); which line is the return (trace the HWR) | copper line types, trace the trunk, chain the branches, a drop, hangers from the copper rule, fittings from bends |
| 4 | `waste` | how far the sanitary line falls (measure 29 ft); which fixture stays out of the interceptor (a note on it); where a cleanout must be (count four); which walls carry a vent stack (count two); hangers under the slab (reveal) | a Waste layer, PVC line types, trace both waste lines on it, Bid Check |
| 5 | `riser` | how long the lavatory's trap arm is (measure it against the table); why a stack keeps going through the roof (reveal) | scale P-601, prove it, trace the stack, count the cleanout at its base |
| 6 | `gas` | the sizes from the meter (reveal); where the hood's valve goes (the RFI placed ahead of the first drop) | a black iron line type, trace the cook line, fittings from bends, count the drops, a hanger row of your own |
| 7 | `details` | why the restrooms are drawn twice (reveal); how many stations the bid carries (the zone's number) | scale P-401, prove it, a scale zone, a multiply zone |
| 8 | `whole` | the whole sheet, by hand as far as the reader likes, the rest laid by the button; then the compare card, run by run against the reference | the reference takeoff, Summary Legend, Export PDFs |
| 9 | `bid` | which Bid Check rows the set already answers (reveal) | tick the rows, the proof view, the notes ledger, the hand-off |

Nine chapters of five to eleven steps, about ninety minutes in all.

**The reference takeoff** (chapter 8) is computed from the same flat point lists the finish
button lays, so it cannot drift from the drawing: every run by size and material with its
feet, and twelve counts, thirty-four marks. The compare card is a body that is a function,
rendered live: the reference's feet beside the reader's, and the run a short one is missing.

## Where it lives

- **features/course-plumbing.js**, a registry feature file: the chapters, their seeds and their
  seam actions (the engine's `App.tutorialDoStep`, since main retired Do it for me for on-sheet
  targets), registered on the tour engine as `course:plumbing:<id>`. It reads
  `App.lessonKit` (the sheet-opening, seeding and marking helpers features/lessons.js already has,
  now exposed) at call time.
- **The Learn menu** gains a third section under the lessons: the course, with a lede, a chapter
  list with ticks and the next chapter lit, and its own progress. Progress is per device,
  localStorage `clickcount-course-done` keyed `plumbing:<id>`.
- **Doors**: the empty-canvas hint ("or the plumbing course, an hour on how a restaurant gets
  its plumbing"), Project Settings → Help → "plumbing course", `/app/?course=plumbing` (the menu,
  scrolled to the course), `/app/?chapter=plumbing:<id>`.
- **Telemetry** rides `tour_step` (`tour: 'course:plumbing:<id>'`). No new event type.
- **Specs**: course-plumbing.spec.js walks every chapter through the engine's seam on real state and
  pins the takeoff each claims, refuses the wrong click and checks the hint that says why, and
  pins the reference and the compare card; teaching-labels.test.js reads the course file too.
- **Three small product changes the course needed**: a tag may carry a hyphen or lead with a
  digit (tag-model.js, so WC-1 and 3CS-1 read as tags); the schedule reader is offered on
  plumbing projects (features/tag-reader.js); Copper and PVC are default Quick materials.
- **The guide**: learning-the-app.md gains the course; plumbing-takeoff.md links its chapters.

## Phases

| Phase | Unit | Done when |
|---|---|---|
| 0 | The drawing: waste, grease, CO, VTR, RPZ, HB, general notes; both PDFs regenerated; the sample-plan and lessons specs still green | `npm run check` green, lessons.spec.js green |
| 1 | The engine's `reveal`; features/course-plumbing.js with the menu section, progress, doors; chapters 1 and 2 | course-plumbing.spec.js green for both, walked live |
| 2 | Chapters 3, 4 and 5 (water, waste, gas) | each pinned by spec, walked live |
| 3 | Chapters 6 and 7; the guides; the CHANGELOG entry | `npm run check` green, walked end to end |

## Rules the course keeps (the tours' and the lessons')

A chapter adds no product behavior. An action goes through a shipped `App.*` writer. Bodies are
lines, one action per `1. …` line, controls as `[[chips]]`, no em dashes. A number quoted in a
body is read live or pinned by spec. A chapter refuses to start over a cloud project and never
becomes the device's trade. And the rulebook's line holds for the coaching: **as the app applies
it, cited by section, never the code reprinted, never company practice.** A reason the sheet
does not show and no section covers is written as practice ("an engineer puts a drain where a
floor gets hosed"), not as a rule.

## Trade findings from the 2026-09-24 read

A read of every step against the sheet's source and the app's code, after a new estimator got lost
on the tours' Prove the scale (CHANGELOG 2026-09-24). These are the TRADE items: the drawing, the
numbers or the teaching, where someone with the trade should say which side is right before anyone
edits. The app-side stalls from the same read (dead-end steps, hints, steps that pass on their own)
are being fixed separately. Each item names the step and where it lives; nothing here was walked
live, and a code citation marked *from memory* came from the reviewer's recollection, not the
printed code.

- **P-401 contradicts P-101** (chapter 7, `details`, course-plumbing.js ~616-642; the sheet in
  scripts/sample-plan-candidates.js ~686-726): five WCs and a urinal on P-401 against two WCs on
  P-101, MEN and WOMEN swapped, the rooms 12'×10' against about 11'-8"×12'-8", and note 2's "(4)
  cook line and bar stations" against three hand sinks. "Count on one sheet, never both" then
  collides with "count one, bid four". Redraw P-401 to match, or make the mismatch the step (an RFI).
- **Trap arm citation** (`riser:traparm` ~544-548 and the riser sheet's note): cited as IPC Table
  1002.2; the IPC trap-arm table is 906.1, and UPC Table 1002.2 would fail this 4' arm at 1-1/2"
  (*from memory*). The step's check also reads only the value, so the FD arm's 4'-0" passes too.
- **Gas hanger spacing** (`gas` chapter ~598): cited as IPC 308.5 at 12 ft; gas piping support
  is the fuel gas code (IFGC 415.1), about 10 ft for 1-1/4" steel (*from memory*).
- **The gas main's sizes** (`gas:meter` to `gas:trace`, ~570-580): the reveal teaches 1-1/2" from
  the meter stepping to 1-1/4", then the course makes one 1.25in BI type and traces the whole main
  with it (so does the reference). Two types split at the WH tee, or trace from the change.
- **U-1 and WC-1 share 4 DFU** (`sheet:row` ~357-362; sheet ~732): the step asks for the row with
  the biggest number in the DFU column, and a reader who picks U-1 is told to look for a bigger
  one. Ask for the biggest waste pipe, or give U-1 another value. P-101 also has no urinal and
  nothing says U-1 is unused (`fixtures:counters` ~382-389).
- **Cleanouts** (`waste:cleanouts` ~507-511): the sheet's note says a cleanout at each turn, the
  grease lines turn five times with none; a reader who follows the note adds marks the check
  ignores but the takeoff keeps.
- **The wet wall** (`fixtures:wetwall` ~377/382): "every fixture against the shared wall or the top
  wall, back to back", but the MEN lav hangs on MEN's west wall and the rooms repeat rather than
  mirror; the 11 ft reading is WC to WC, not a length of wall.
- **Which hand sink** (`fixtures:handsinks` ~391-395): the right one is about 8 ft from the range
  past the prep sink; the exit hand sink is as close to the fryer end, and "under HOOD ABOVE" does
  not tell them apart.
- **Words that do not match the sheet**: `fixtures:keys` (~412) says ten little 1/2" lines ride the
  primers (only the primer row is added); `waste:layer` (~490) says the red note is nine words (it
  is seven); `gas:trace` / `gas:drops` (~578, ~587) say "behind the cook line", but the line is
  drawn on the aisle side.

## Open, and not blocking

- **A trade review** of chapters 2 to 6 (the gas chapter cites the fuel gas code too) and the
  fixture units on P-501 (PC-REVIEW on the punch list). The coaching bodies cite the IPC, the FDA
  Food Code and NFPA 96 by section; someone with the trade reads them once before the course is
  offered on the landing.
- **Rulebook pages for the DWV rules** the course cites (slope, cleanouts, vents, the
  interceptor, backflow). The rulebook's format wants a value row with a code pointer and the
  app applies none of these yet, so they wait for the drainage slice (WATER-PLAN.md Q6).
- **The electrical and HVAC courses** followed the same day, each on its own set, in this
  file's format: [ELECTRICAL-COURSE.md](ELECTRICAL-COURSE.md), [HVAC-COURSE.md](HVAC-COURSE.md)
  (re-stamped 2026-09-23; this line had them waiting on E-101 and M-101).

# The electrical course: how a restaurant gets its power, on the app

> Plan of record, written 2026-09-21 as the plumbing course (PLUMBING-COURSE.md) merged. The
> owner: "let's do the electrical and hvac in order asking ourselves along the way, is this the
> best we can do?" Same format as the plumbing course: the engineer's drawing is the answer key,
> a question is answered with a click, the app's own checks teach where they can.

## What the plumbing course settled, and what is different here

- **Same engine, same rules, same doors.** Nine chapters on the tour engine, the lesson kit,
  the on-sheet targets, a question step drawing none, the seam for the spec, a section in the
  Learn menu (the menu now holds one section per course, `App.courseSections`), the empty-canvas
  link, Project Settings → Help, `/app/?course=electrical`, `/app/?chapter=electrical:<id>`.
- **Its own set.** The lesson kit learned to open a set a lesson names (`lesson.set`), so the
  plumbing set stays four sheets and the electrical course brings four of its own.
- **The app does electrical math.** Unlike plumbing, where fixture-unit sizing is not built, the
  electrical side already judges conduit fill, voltage drop, circuits against the panel schedule
  and devices reached by runs. The course is built around letting those rows teach: the
  voltage-drop row warns at the default 12 A and clears at the 6 A the engineer scheduled; the
  fill row judges the feeder the reader traces.

## The set (scripts/sample-electrical.js, `npm run build:sample-electrical`)

The same Main St Restaurant as P-101, on the same shell: `restaurantShell(opts)` was factored
out of P-101's drawing (scripts/sample-plan-candidates.js) with the lights, the plumbing keytags
and the floor drains as options, so a device on E-101 sits at a P-101 coordinate and P-101 itself
is unchanged (proved element for element before the refactor was kept).

| Sheet | Carries | Teaches |
|---|---|---|
| **E-101 Power plan** | 11 duplex drawn at 18" (one of them the engineer's miss, in the kitchen, counted as a GFCI since 2026-09-27: 10 duplex and 11 GFCI in the takeoff), 10 GFCI drawn at 44" (the bar, the kitchen, the restrooms, within 6 ft of any sink), a J-box at each of six pieces of equipment with its circuit, panel LP-1 on the storage wall with a dashed 36" × 30" working clearance, the meter and 200 A main outside the south wall, the feeder, homerun arrows with circuit tags | 210.8(B), 110.26, mount heights, the homerun |
| **E-201 Lighting plan** | 36 fixtures each with its TYPE letter beside it (A pendant ×13, B troffer ×10, C downlight ×8, X exit ×2, EM ×3), switches and three occupancy sensors, homeruns | the tag reader ("Plan says B"), 700.12 / IBC 1008, IECC C405.2.1 |
| **E-501 Schedules** | the lighting fixture schedule (tag + description rows) and LP-1's panel schedule: 19 circuits with VA, poles, breaker, wire, conduit; the connected load | the schedule reader, 240.4(D) and 310.16, why #10 for the dishwasher |
| **E-601 One-line** | utility, meter, main, feeder (4 #3/0 + #6 G in 2"), LP-1, the grounding electrode | 310.16, 250.122, 250.66, Article 220, three phase |

## The chapters

| # | id | The questions, answered by a click (or a reveal) | Doing (the app) |
|---|---|---|---|
| 0 | `before` | Before you count, the opener (2026-09-27): what a set and an E-sheet are, what an estimator does with them (the takeoff), the four verbs (count, trace, chain, check), where the header, sidebar and status bar are, the line beside Show me where. Ahead of the nine and not counted among them | none: five read cards, no zones, no rules |
| 1 | `sheet` | why two plans (reveal); where the panel is (count it); how deep the space in front of it (measure 36"); which circuit is 208 V two-pole (highlight the row); why #10 (reveal) | scale, prove it, a Quick counter, Measure, Highlight |
| 2 | `devices` | which receptacles must be GFCI (click all ten, none of the duplexes; a wrong click is told why); the one the engineer drew plain in the kitchen (find it, flag it with an RFI); where the heights come from (reveal) | Quick counters with mount heights, count 27 devices with circles, Quick Keys |
| 3 | `lighting` | which fixtures stay lit when the power fails (a note on an X or EM); which rooms switch themselves off (count the OS); why (reveal) | the schedule reader on E-501, 36 fixtures placed by the letter, tag-aware placement |
| 4 | `conduit` | why #12 (reveal) | a line type with raceway and conductors, the ceiling and make-up, chain the west wall (verticals written), the fill row, a strap row of your own |
| 5 | `circuits` | is the engineer wrong about #12 (the voltage-drop row at 12 A, then the scheduled 6 A) | a group as a circuit, the homerun flag and trace, the panel's poles, the cross-check rows |
| 6 | `equipment` | which equipment is three phase (a note on RTU-1's J-box); why three phase, why one circuit each (reveals) | the shunt-trip RFI placed at the cook line |
| 7 | `service` | why 3/0, #6, 200 A (reveal) | trace the feeder with its conductors, the rise, the fill row on it, count the meter and the main |
| 8 | `whole` | the whole set by hand or by the button, then the compare card | the reference takeoff, the report's circuit schedule, Summary Legend |
| 9 | `bid` | which manual rows the set already answers (reveal) | tick three, the proof view, Open in TakeoffTooling |

**The reference** (chapter 8): 69 marks in twelve device types across the two plans; the west-wall
chain 60.5 ft (22.5 on the plan and four 9.5 ft verticals the chain wrote), the homerun 84.17 ft,
the feeder 15.83 ft with its 8.5 ft of vertical (12.33 with a 5 ft rise until 2026-09-27). Computed from the same flat geometry the button lays.

**The language (2026-09-27).** Todd read the language memo (`journeys/plans/COURSE-LANGUAGE-2026-09-27.md`)
and chose option C: the reader is anyone at all. So the course opens with `before`, every trade and
app word is glossed where the course first uses it (a receptacle is a wall outlet, a homerun the
conduit that carries a circuit's wires back to the panel, VA volt-amperes), a doing card leads with
its numbered steps (the last question's answer above them under "Answer:", at most two sentences of
orientation), and no card sentence runs past 25 words. The numbers, the sections and the trade
claims did not change; EC-TRADE and RULEBOOK-SIGN still hold them.

## Trade findings from the 2026-09-24 read

A read of every step against the sheet's source and the app's code, after a new estimator got lost
on the tours' Prove the scale (CHANGELOG 2026-09-24). These are the TRADE items: the drawing, the
numbers or the teaching, where someone with the trade should say which side is right before anyone
edits. The app-side stalls from the same read (dead-end steps, hints, steps that pass on their own)
are being fixed separately. Each item names the step and where it lives; nothing here was walked
live, and a code citation marked *from memory* came from the reviewer's recollection, not the
printed code.

- **Two 208 V two-pole circuits on E-501** (`sheet:schedule` ~306-309): the step wants "the one",
  and both DW (2,4) and EF-1 (8,10) are. A reader who picks EF-1 is told to look for what it
  already is. Ask for the dishwasher's row. Near it: `row` (~312) says every other circuit is #12
  (RTU-1 is #8) and `equipment:poles` (~482) says everything else is one pole (EF-1 is two).
- **The receptacle story in chapter 2** (~325, ~337): "twenty receptacles" where the sheet has 21
  (and the chapter's done text says 21; the count fixed 2026-09-27, DS-AGENT-NITS); the kitchen duplex that 210.8(B)(2) makes GFCI is accepted
  as GFCI in `gfci` and then counted again as a duplex in `duplex`, whose body calls it both. Pick
  one answer, and tell `gfci` to leave it.
- **E-601 calls the dishwasher three phase** (scripts/sample-electrical.js ~270, note 2); E-501 and
  the course say single phase.
- **The rise** (`service:rise` ~515): MDP at 5 ft and the panel top at 6'6" make a 1.5 ft rise;
  the step asks for 5 ft with "12 ft minus 7" as the only reason. Say which drawing gives the
  12 ft, or change the heights.
- **The clearance** (`sheet:clearance` ~301-304): "wall to its outer edge", but the dashed box
  starts at the panel face, 10 in off the wall, so a wall click reads 3'-10". Measure from the
  panel face, or draw the box from the wall.
- **Arrows that are not where the text says**: `circuits:homerun` (~443) puts LP-1-1 at the top
  receptacle (it is between the 2nd and 3rd); `sheet:panel` (~295) has every homerun arrow point
  at the panel (they are sideways stubs, LP-1-9 points away). Reworded 2026-09-27 (DS-AGENT-NITS):
  the arrows are named by their tags, not their aim.

**Settled 2026-09-27** on the owner's delegation, from the tester dossier's research: every item
above is decided and applied (the dishwasher's row is the one asked for, the missed receptacle is
counted once as a GFCI, E-601 names RTU-1 alone, the feeder rises 8.5 ft into the ceiling and down
into LP-1's top, the clearance is measured from the panel's face), and the course speaks NEC 2023.
The decision log is the dossier's [Settled 2026-09-27](TESTER-DOSSIER-ELECTRICAL-2026-09-27.md#settled-2026-09-27).

## Open, and not blocking

- **A trade review** of chapters 2 to 7 and the panel schedule's loads and sizes (EC-REVIEW).
- **Fire alarm** is deliberately absent from the set; chapter 9 says so. A fire alarm sheet would
  teach the FA row and the rated-corridor question.
- **The HVAC course** followed the same day, on its own set: [HVAC-COURSE.md](HVAC-COURSE.md).

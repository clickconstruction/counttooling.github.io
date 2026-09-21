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
| **E-101 Power plan** | 10 duplex at 18", 10 GFCI at 44" (the bar, the kitchen, the restrooms, within 6 ft of any sink), a J-box at each of six pieces of equipment with its circuit, panel LP-1 on the storage wall with a dashed 36" × 30" working clearance, the meter and 200 A main outside the south wall, the feeder, homerun arrows with circuit tags | 210.8(B), 110.26, mount heights, the homerun |
| **E-201 Lighting plan** | 36 fixtures each with its TYPE letter beside it (A pendant ×13, B troffer ×10, C downlight ×8, X exit ×2, EM ×3), switches and three occupancy sensors, homeruns | the tag reader ("Plan says B"), 700.12 / IBC 1008, IECC C405.2.1 |
| **E-501 Schedules** | the lighting fixture schedule (tag + description rows) and LP-1's panel schedule: 19 circuits with VA, poles, breaker, wire, conduit; the connected load | the schedule reader, 240.4(D) and 310.16, why #10 for the dishwasher |
| **E-601 One-line** | utility, meter, main, feeder (4 #3/0 + #6 G in 2"), LP-1, the grounding electrode | 310.16, 250.122, 250.66, Article 220, three phase |

## The chapters

| # | id | The questions, answered by a click (or a reveal) | Doing (the app) |
|---|---|---|---|
| 1 | `sheet` | why two plans (reveal); where the panel is (count it); how deep the space in front of it (measure 36"); which circuit is 208 V two-pole (highlight the row); why #10 (reveal) | scale, prove it, a Quick counter, Measure, Highlight |
| 2 | `devices` | which receptacles must be GFCI (click all ten, none of the duplexes; a wrong click is told why); where the heights come from (reveal) | Quick counters with mount heights, count 26 devices with circles, Quick Keys |
| 3 | `lighting` | which fixtures stay lit when the power fails (a note on an X or EM); which rooms switch themselves off (count the OS); why (reveal) | the schedule reader on E-501, 36 fixtures placed by the letter, tag-aware placement |
| 4 | `conduit` | why #12 (reveal) | a line type with raceway and conductors, the ceiling and make-up, chain the west wall (verticals written), the fill row, a strap row of your own |
| 5 | `circuits` | is the engineer wrong about #12 (the voltage-drop row at 12 A, then the scheduled 6 A) | a group as a circuit, the homerun flag and trace, the panel's poles, the cross-check rows |
| 6 | `equipment` | which equipment is three phase (a note on RTU-1's J-box); why three phase, why one circuit each (reveals) | the shunt-trip RFI placed at the cook line |
| 7 | `service` | why 3/0, #6, 200 A (reveal) | trace the feeder with its conductors, the rise, the fill row on it, count the meter and the main |
| 8 | `whole` | the whole set by hand or by the button, then the compare card | the reference takeoff, the report's circuit schedule, Summary Legend |
| 9 | `bid` | which manual rows the set already answers (reveal) | tick three, the proof view, Open in TakeoffTooling |

**The reference** (chapter 8): 68 marks in twelve device types across the two plans; the west-wall
chain 60.5 ft (22.5 on the plan and four 9.5 ft verticals the chain wrote), the homerun 84.17 ft,
the feeder 12.33 ft with its rise. Computed from the same flat geometry the button lays.

## Open, and not blocking

- **A trade review** of chapters 2 to 7 and the panel schedule's loads and sizes (EC-REVIEW).
- **Fire alarm** is deliberately absent from the set; chapter 9 says so. A fire alarm sheet would
  teach the FA row and the rated-corridor question.
- **The HVAC course** is next, on M-101 and its own set, the same way.

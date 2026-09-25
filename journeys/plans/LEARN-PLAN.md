# LEARN — the trade guides made true, and lessons for every part of the app

> Plan of record, written 2026-09-21 after a docs pass, a live walk of the plumbing and
> HVAC tours, and a sweep of every feature against the three tours and the 27 guides.
> The owner's ask: "make sure the plumbing, electrical and HVAC guides are good, and then
> offer a user a tutorial where they can go through and use all parts of the app."
> Approved the same day: build all of it, ship each phase as it completes.

## What the pass found

- **No guide was updated after 2026-09-14**, so everything shipped since is undocumented:
  fittings from bends and the vertex menu, the compact sheet legend, sheets named from the
  title block, report titles. The rulebook, the § chips and hangers from rules are older
  and also in no guide.
- **Plumbing guide**: the intro promises Chain, hangers, RFI flags and the proof view; the
  body covers none of them. It named a "Copy to PipeTooling" button; the label is
  "Copy to /Tooling" (the same stale name sat in four more guides and the plumbing tour).
- **HVAC guide**: "Measure the runs" said to trace duct with Line and Polyline, against its
  own intro. No Duct tool, no sizing at S, no Duct Schedule, no Bid weight.
- **Electrical guide**: the strongest, but no tour pointer, no screenshot, and a legend
  sentence the compact legend made wrong.
- **Tour bugs seen in the walk**: a plumbing step titled "Count the Men's room" that counts
  Women 108; the proof dialog left open over "Hand it off", so the export buttons never
  light; the HVAC tour naming a "Legend Settings" dialog whose title is "Summary Legend";
  with a saved local session a `?tour=` link gets the "Project from Last Session" prompt on
  top of it (seen twice); once, scripted, the plumbing tour's counters appeared inside the
  HVAC tour; at phone width the card covers the bottom 40% and the copy says "press S".

## Decisions (the owner's, taken 2026-09-21)

1. **Short lessons, not one long tutorial.** A 60-step tour does not get finished; lessons
   resume, and a guide can link straight into one.
2. **The lessons run on the engineered sample plan** (P-101, drawn to carry one of
   everything). The three five-minute trade tours stay on the design-build plan as the
   front door. E-101 and M-101 (SAMPLE-PLANS.md §3) wait; nothing here blocks them.
3. **Cloud features are a read-only chapter** that links into the guides. A tour refuses to
   run on a cloud project, and a faked sign-in would teach a screen nobody will see.
4. **Desktop and tablet first.** Phones get wording that fits them, not a second design.

## Phases

| Phase | Unit | Done when |
|---|---|---|
| 0 ● | Quick fixes: the stale labels, the two mis-named tour steps, GUIDES-PLAN re-stamped, and `teaching-labels.test.js` (every `[[control]]` a tour names exists in the shell; no guide or tour uses a retired label) | `npm run check` green, merged |
| 1 ● | The three trade guides rewritten to follow their tours, every claim walked in the app first, screenshots from `build:screenshots` | one PR per trade, `guides.spec.js` green |
| 2 ● | Engine hardening: a step closes the dialogs the last one left open; the restore offer never lands on a `?tour=` start and a tour never inherits a device backup's marks; touch wording | each pinned in tutorial.spec.js |
| 3 ● | The lesson framework: a Learn menu, lessons seeded from a canned state so each stands alone, a tick per lesson, `?lesson=<id>`; first three lessons; dormant behind `?ff=learn` | spec green, walked live |
| 4 ● | The remaining lessons (the table below) | every lesson's do-it-for-me path pinned by spec |
| 5 ● | The flip: Learn is on for everyone, the guides carry "Try it" links, `tour_step` names the lesson | flag reads deleted |

> **Built 2026-09-21, all five phases.** Three things changed in the build, each for a reason found
> by doing it:
> 1. **The lessons got their own three-sheet set**, not the engineered sheet alone. P-101 has no
>    second page, no detail at another scale and no typical, so Sheets, Scale and Repeats had
>    nothing honest to teach on. `samples/sample-lessons.pdf` is P-101 unchanged plus P-401 and
>    P-501 drawn for the purpose. This is rung 2 of SAMPLE-PLANS.md §5 in spirit (a TYP bay, an
>    enlarged detail), built as new sheets so the engineered plan and the films stay as they are.
> 2. **No dormant stage.** Learn shipped on (see the CHANGELOG entry for why).
> 3. **The Sheets lesson teaches Trim your set by hand**, because a multi-sheet PDF opens it
>    anyway; every other lesson presses its Open for the reader.

> **Changed 2026-09-21, the same day, after the owner used it:** no step can be clicked through.
> Sheet work is asked for inside circles and boundaries drawn on the plan and only counts there;
> "Do it for me" became "Show me where"; Next waits for the step; a quiet Skip remains. The line
> below about "Do it for me" describes the first build. Detail: the CHANGELOG entry of that date.

## The lessons

Each is 4 to 8 steps, two or three minutes, on the engine the tours already use (a step is
`{ id, title, body, kind, target, check(), action?, hint? }`; `check()` reads real state;
"Do it for me" goes through the same `App.*` entry points a click would).

| # | id | Teaches |
|---|---|---|
| 1 | `plans` | pages, rename a sheet, rotate, marked-page jumps, where Prepare PDF lives |
| 2 | `scale` | set and prove the scale, a scale zone over a detail drawn at another scale |
| 3 | `counting` | a counter, the Quick creator, Quick Keys on the number row, counter settings |
| 4 | `measuring` | line, polyline, snap to 45°, a drop, fittings from bends |
| 5 | `chain` | Chain, child counts, the hanger rule and its § chip |
| 6 | `repeats` | a multiply zone over a typical bay |
| 7 | `organize` | groups, the sidebar filter, layers, the peek, hide marks |
| 8 | `fixing` | undo, the right-click menu, item details, Delete Area |
| 9 | `notes` | a note, an RFI flag, a highlight |
| 10 | `check` | Bid Check, the proof view, the Summary Legend's styles |
| 11 | `deliver` | Show Report, Export PDFs, Copy to /Tooling, Copy Summary |
| 12 | `speed` | the keyboard map, the hotkey peek, the zoom rail |
| 13 | `cloud` | read-only: saving, sharing, view links, bids, each with its guide |

## Rules the lessons keep (from H1-HVAC-TOUR.md, unchanged)

A lesson adds no product behavior. An action goes through a shipped `App.*` writer, never a
hand-built state change where a writer exists. Bodies are lines, one action per `1. …`
line, controls as `[[chips]]`, no em dashes. Numbers quoted in a body are read live or
pinned by spec. A lesson refuses to start over a cloud project, and never becomes the
device's default trade.

## Card wording that does not match the screen (the 2026-09-24 read)

> **Done 2026-09-24** (COURSE-WORDING closed; CHANGELOG "fix(lessons): the card wording…"). Every
> item below was checked against the shell or walked, then fixed as listed. The list is kept as the
> record of what was wrong.

From the same read that found the courses' trade items (their plan files) and the stalls (fixed
separately): step cards that describe the screen wrongly or not at all. None stops the reader for
good, and each is an edit to a step body or hint. Items marked *suspect* were read in code, not
walked.

**The plumbing tour** (features/tutorial.js `PLUMBING_STEPS`, walked live):
- `size`: "The card above the sheet reads…": the water card sits at the bottom of the sheet.
  "Pick 1in PEX" says nowhere to pick it (it is already the active type). "1in holds, 3/4in would
  do" never says why to step down (3/4" also stays under 8 fps and costs less). The size popover
  opens over circle 2, the next place the card sends the reader.
- `wsfu`: "its public word flips one counter to the private column" does not say what public and
  private mean (the IPC table's two columns) or that the word is a button.

**The HVAC course** (features/course-hvac.js):
- `system:designed` (~405) and `main:fittings` (~441): designed air is "on the DUCT section's
  header"; it is on RTU-1's row under GROUPS, and in chapter 4 the DUCT section is not on screen.
- `rooms:dining` (~337) and the `rooms:kitchen` hint (~349): "click the pencil beside DINING";
  room rows have no pencil, a click on the row opens Edit Room.
- `sheet:unit` (~308): the Quick tab offers "Size, Type and Mounting"; the third field is Material.
- `system:group` (~399): "In ESP, type 1.0"; the field is labelled Static available.
- `main:arm` (~418): "Set Liner to Wrap"; the select is labelled Insulation.
- `sheet:schedule` (~314): "Under PAGES, click M-501", but the Quick Add Counter a step before
  collapsed PAGES.
- `main:arm` / `main:kitchen` (~418, ~432, *suspect*): the size prefill reads the callout nearest
  the cursor's last spot, so the kitchen branch may open at 12x10, not 16x10, and neither step has
  a hint; `main:trace`'s hint goes quiet once a run with a missed step-down is committed. Give each
  step its size in the body and a hint for a committed run at the wrong sizes.
- `bid:handoff` (~561) and `bid:rows` (~550): Copy RFI Flags "puts the hood question beside it",
  but no step makes an RFI; the rows reveal cites "the two you counted", and chapter 9 seeds no
  fire dampers.

**The electrical course** (features/course-electrical.js):
- `bid:handoff` (~574): Copy RFI Flags "puts the shunt-trip question beside it", but chapter 9
  seeds no RFI note.
- Chapter 8 `lay` (*suspect*): the Quick tab names the meter "Meter Panel", which `/panel/i`
  matches, so with the meter armed the hint can say "Not all counted: Panelboard" over a counted
  panel. Tighten `RE.panel` to `/panelboard|\blp-/i`.
- `service:gear` (~522) and `conduit:chain` (~411, *suspect*): no hint. The meter and MDP circles
  are 17 pt apart, so a click with the other counter armed is easy; a chain with a counter that has
  no mount height, or no ceiling set, writes no drops and the card just waits.

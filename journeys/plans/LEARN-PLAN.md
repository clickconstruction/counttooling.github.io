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
| 0 | Quick fixes: the stale labels, the two mis-named tour steps, GUIDES-PLAN re-stamped, and `teaching-labels.test.js` (every `[[control]]` a tour names exists in the shell; no guide or tour uses a retired label) | `npm run check` green, merged |
| 1 | The three trade guides rewritten to follow their tours, every claim walked in the app first, screenshots from `build:screenshots` | one PR per trade, `guides.spec.js` green |
| 2 | Engine hardening: a step closes the dialogs the last one left open; the restore offer never lands on a `?tour=` start and a tour never inherits a device backup's marks; touch wording | each pinned in tutorial.spec.js |
| 3 | The lesson framework: a Learn menu, lessons seeded from a canned state so each stands alone, a tick per lesson, `?lesson=<id>`; first three lessons; dormant behind `?ff=learn` | spec green, walked live |
| 4 | The remaining lessons (the table below) | every lesson's do-it-for-me path pinned by spec |
| 5 | The flip: Learn is on for everyone, the guides carry "Try it" links, `tour_step` names the lesson | flag reads deleted |

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

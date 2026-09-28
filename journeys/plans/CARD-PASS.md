# The card pass: every card, one at a time (started 2026-09-28)

Will, 2026-09-28: "go through each card individually and ask yourself is this the best we can do,
improving along the way ... do them sequentially so if we run out of tokens we can pass off the
work to someone else."

This file is the hand-off. It says what the pass is, how to do one card, and where it has got to.

## What the pass is

The card review (2026-09-27, [CARD-REVIEW.md](CARD-REVIEW.md)) held every card to ten rules with
twelve agents at once. This pass is slower and single-handed: each card is opened in the app, read
as a first-time reader, and improved until the answer to "is this the best we can do?" is yes.

## How to do one card

1. Open it in the app (`/app/?lesson=<id>`, `/app/?tour=<id>`, `/app/?chapter=<course>:<id>`;
   `App.tutorialGoTo('<card id>')` jumps, `App.tutorialDoStep()` does a step).
2. Read it against the ten rules in CARD-REVIEW.md. Then ask the five questions below.
3. Fix what fails. Wording, what is lit, the order of the sentences, a gloss, a touch line.
4. Look at it on screen: every chip clicked, the lit area, the card inside a 1280 x 720 window.
5. `node scripts/score-courses.js --check`, `node scripts/check-lesson-rules.js`,
   `node --test teaching-labels.test.js`, and the spec file for that entry.
6. Tick the chapter below when all its cards are done. Commit. One PR per entry (a tour, the
   lessons, a course), merged before the next is started, so main never drifts far.

**The five questions.**
- Would a person who has never seen a drawing know what to do, from this card alone?
- Is every sentence earning its place? What could go and not be missed?
- Does the card show the thing, or only describe it?
- If the reader does exactly what it says, does it work, first time, on a laptop and on a tablet?
- Does it leave the reader knowing something they can use on their own plan tomorrow?

## What does NOT change without Will

A number, a code citation, a trade fact, the order of a course, what a step checks. Those go on
[the owner's list](CARD-REVIEW-OWNERS-LIST.md), under the entry's heading, as a one-line question
with a recommendation. (The six he has said to fix are listed first, below.)

## Where it has got to

Work the entries in the order below, top to bottom, and the chapters inside each in order. A
ticked chapter is done. The line under "Now" names the card in hand.

**Now:** the first pass is complete: every entry below is ticked. What is left is listed under "Still to do".

### The six fixes, before the pass

- [x] 1. The plumbing tour ends with two Bid Check warnings it never mentions: a Bid Check card, and a takeoff that passes. DONE, the first half: a `bidcheck` card sits between `proof` and `handoff` (18 cards now). It opens BID CHECK, lights the two warning rows and says why each one warns (the x3 zone made the 1in pipe too small; the tour drew no hot water). The takeoff still warns on purpose: two real warnings read aloud teach more than a clean list. The hand-off card now says the copy asks first.
- [x] 2. The electrical course's homerun and feeder steps pass while the run is still a draft: require the run finished. DONE: both checks want no live draft; the circles still tick as the reader goes, and the card's line says "The path is in. Click Finish under the sheet to end the run".
- [x] 3. Each course's Chapter 0 follows Start here: one card per screen area, and no "how cards work" card. DONE in all three courses: `screen` / `where` became `header`, `sidebar` and `bottom`, each lighting its own area, and the `cards` card is gone. Openers and intros no longer count the cards.
- [x] 4. A card that opens with the last question's answer does two jobs: the answer shows on the question's own card. DONE: a step's new `answer` field (features/tutorial.js). Once the reader's click is right the card shows the answer in place of the task and waits for Next. 23 answers moved back to their question cards across the three courses, with the explanation that trailed them and their rule ids; the voltage-drop card asks a thinking question, so its answer waits behind a Show the answer button. The language check and the rules check read `answer` too.
- [x] 5. Cards about number keys have no tablet version: skipped on touch. DONE: a step's new `keys: true` flag (features/tutorial.js). On a tablet or a phone the tour leaves those cards out and counts its steps without them: counting `bind` and `usekey`, and `keys` in the plumbing and electrical courses. The blank-sheet tour keeps its card, which already has a touch version. The counting recap drops "a number key" on touch.
- [x] 6. The HVAC tour quotes 442 CFM where the screen reads 508: the number goes. DONE: the card says the four diffusers give 600 CFM, more than the office needs (the room's own figure depends on the box the reader drags, so the card no longer quotes it).

### Still to do

- The blank-sheet tour was walked, not rewritten: no card is over 551 px, nothing scrolls, every chip
  that can be lit is lit, and it was already written for touch. Its closing tips were left under the
  steps on purpose: with 37 cards, an answer on each would add thirty clicks of Next.
- A tablet reading of the three courses. The first pass walked them on a laptop (1280 x 720) and
  fixed the keyboard-only lines it found; `cardshots.js course:<trade>:<chapter> <outdir> tablet`
  walks one on a tablet.
- The owner's list ([CARD-REVIEW-OWNERS-LIST.md](CARD-REVIEW-OWNERS-LIST.md)) still holds what needs Will:
  a number, a citation, a trade fact, what a step checks. The pass settled these rows of it:
  the Set Scale tab step, the "how cards work" cards, the three-areas-on-one-card cards, the
  answer-on-the-next-card pattern, the plumbing tour's Bid Check, the scrolling cards, number keys
  on touch, "Press Enter" on touch, the badge wording, plans/rename's name, and the Trim step.
- Guide screenshots and the landing films show the old cards (`npm run build:screenshots`).

### The pass

Engine changes the pass has made so far, which every later card gets for free:
- On a touch screen "Click" reads "Tap", in the card and in its status line (`tapText`).
- The sheet is lit only as far as it shows (the ring no longer draws lines across the sidebar).
- A hands-off step's button can step aside (`action.show`): Sheets' opening card is two states.
- Tools for the pass, in the session scratchpad: `cardshots.js <lesson:id | tour id> <outdir> [tablet] [only ids]`
  walks an entry and prints each card with its chips, lit box and card box, and saves a screenshot;
  `testat.sh <log> <specs>` runs specs against HEAD in a second worktree (`card-pass-test`), so the
  tree being edited is never the tree under test.

- No Set Scale card asks for the Architectural & Engineering tab any more: the dialog opens on it
  for a sheet with no scale (nine cards, every tour and course).
- A doing card whose text ran on after its steps now gives that text as its `answer`, once the step
  is done: shorter while the reader works, and the result is read when there is a result.

- `answerWaits`: an answer whose step ends with Click Done waits until the dialog is closed; the status
  line says "That is in. Now close the dialog" meanwhile.
- An answered step stays done for the rest of its visit, so closing the dialog the answer explains
  does not take Next away.
- `bidCheckRows(key, ids)` (tourKit): once BID CHECK is open its heading goes to the top of the sidebar
  and the named rows are lit. It opened under the fold of a laptop screen.
- Specs wait for a step with `stepTo(page, id)` (spec-helpers.js): it clicks Next on a card that is
  done and holding on its answer, the way a reader does.
- The plumbing tour's size card and the HVAC tour's duct card are three states each, as long as what
  the reader is doing: the size card was 696 px of a 720 px window and scrolled.

- A long card is a wider card (470 px past 700 characters): an engineer's answer stood 696 px tall
  in a 720 px window and scrolled.
- In the courses "Press Enter" after a trace reads "Click Finish under the sheet (or press Enter)":
  a tablet dropped the line and had no way on.

- A very long card (past 1,200 characters) is 560 px wide. The electrical course's one-line card still
  scrolled at that width, so it is two cards now: `oneline`, then `read`.
- In the HVAC course a duct run ends at Finish Duct Run under the sheet and sizes open from Size…,
  the buttons a tablet has; the keys are the aside.

Found on the way, fixed: the page badge was described the wrong way round in three cards (a yellow
NUMBER means the sheet has a scale, a yellow OUTLINE means it carries marks).

## The lessons (Start here, then the thirteen)  (features/lessons.js)

- [x] **start** (8): (open), header, sidebar, bottom, try, paths, words, (done)
- [x] **plans** (7): (open), jump, rotate, rename, marked, prepare, (done)
- [x] **scale** (7): (open), set, prove, zone, provezone, more, (done)
- [x] **counting** (7): (open), counter, place, bind, usekey, settings, (done)
- [x] **measuring** (7): (open), snap, trace, bends, drop, read, (done)
- [x] **chain** (5): (open), chain, hangers, rule, (done)
- [x] **repeats** (4): (open), zone, read, (done)
- [x] **organize** (8): (open), groupson, group, assign, filter, layer, hide, (done)
- [x] **fixing** (6): (open), undo, context, details, area, (done)
- [x] **notes** (6): (open), note, rfi, highlight, ledger, (done)
- [x] **check** (7): (open), open, fix, tick, proof, legend, (done)
- [x] **deliver** (6): (open), report, pdfs, tooling, email, (done)
- [x] **speed** (5): (open), map, rail, rightclick, (done)
- [x] **cloud** (5): (open), saved, share, bids, (done)

## The plumbing tour  (features/tutorial.js)

- [x] **welcome** (1): welcome
- [x] **scale** (1): scale
- [x] **measure** (1): measure
- [x] **counter** (1): counter
- [x] **place** (1): place
- [x] **linetype** (1): linetype
- [x] **chain** (1): chain
- [x] **drop** (1): drop
- [x] **hangers** (1): hangers
- [x] **waterside** (1): waterside
- [x] **wsfu** (1): wsfu
- [x] **size** (1): size
- [x] **zone** (1): zone
- [x] **rfi** (1): rfi
- [x] **proof** (1): proof
- [x] **bidcheck** (1): bidcheck
- [x] **handoff** (1): handoff
- [x] **done** (1): done

## The electrical tour  (features/tutorial.js)

- [x] **welcome** (1): welcome
- [x] **scale** (1): scale
- [x] **measure** (1): measure
- [x] **trade** (1): trade
- [x] **counter** (1): counter
- [x] **place** (1): place
- [x] **linetype** (1): linetype
- [x] **ceiling** (1): ceiling
- [x] **chain** (1): chain
- [x] **circuit** (1): circuit
- [x] **summary** (1): summary
- [x] **bidcheck** (1): bidcheck
- [x] **handoff** (1): handoff
- [x] **done** (1): done

## The HVAC tour  (features/tutorial.js)

- [x] **welcome** (1): welcome
- [x] **scale** (1): scale
- [x] **measure** (1): measure
- [x] **room** (1): room
- [x] **counter** (1): counter
- [x] **place** (1): place
- [x] **system** (1): system
- [x] **duct** (1): duct
- [x] **attach** (1): attach
- [x] **schedule** (1): schedule
- [x] **bidcheck** (1): bidcheck
- [x] **handoff** (1): handoff
- [x] **legend** (1): legend
- [x] **done** (1): done

## The blank-sheet tour  (features/tour-blank.js)

- [x] **welcome** (1): welcome
- [x] **scale** (1): scale
- [x] **measure** (1): measure
- [x] **move** (1): move
- [x] **counter** (1): counter
- [x] **count** (1): count
- [x] **quickkeys** (1): quickkeys
- [x] **linetype** (1): linetype
- [x] **snap** (1): snap
- [x] **polyline** (1): polyline
- [x] **chain** (1): chain
- [x] **drop** (1): drop
- [x] **duct** (1): duct
- [x] **highlight** (1): highlight
- [x] **multiply** (1): multiply
- [x] **scalezone** (1): scalezone
- [x] **room** (1): room
- [x] **ghost** (1): ghost
- [x] **deletearea** (1): deletearea
- [x] **note** (1): note
- [x] **toggles** (1): toggles
- [x] **undo** (1): undo
- [x] **layers** (1): layers
- [x] **pages** (1): pages
- [x] **zoom** (1): zoom
- [x] **sidebar** (1): sidebar
- [x] **groups** (1): groups
- [x] **summary** (1): summary
- [x] **bidcheck** (1): bidcheck
- [x] **settings** (1): settings
- [x] **savestatus** (1): savestatus
- [x] **exportmenu** (1): exportmenu
- [x] **share** (1): share
- [x] **exports** (1): exports
- [x] **clearpage** (1): clearpage
- [x] **close** (1): close
- [x] **done** (1): done

## The plumbing course  (features/course-plumbing.js)

- [x] **before** (8): (open), set, estimator, verbs, header, sidebar, bottom, (done)
- [x] **sheet** (9): (open), what, scale, prove, keynotes, schedule, row, units, (done)
- [x] **fixtures** (10): (open), wetwall, counters, restrooms, handsinks, kitchen, floorsinks, primers, keys, (done)
- [x] **water** (12): (open), service, trunk, linetypes, trace, hot, chain, drop, hangers, bends, read, (done)
- [x] **waste** (12): (open), downhill, two, layer, linetypes, ss, gw, cleanouts, vents, open, underslab, (done)
- [x] **riser** (8): (open), scale, prove, traparm, stack, why, co, (done)
- [x] **gas** (9): (open), meter, linetype, trace, bends, drops, hood, hangers, (done)
- [x] **details** (8): (open), why, scale, prove, zone, multiply, read, (done)
- [x] **whole** (6): (open), lay, compare, legend, pdfs, (done)
- [x] **bid** (8): (open), open, rows, tick, proof, ledger, handoff, (done)

## The electrical course  (features/course-electrical.js)

- [x] **before** (8): (open), set, estimator, verbs, header, sidebar, bottom, (done)
- [x] **sheet** (9): (open), what, scale, prove, panel, clearance, schedule, row, (done)
- [x] **devices** (8): (open), gfci, missed, duplex, heights, jbox, keys, (done)
- [x] **lighting** (7): (open), schedule, plan, power, os, why, (done)
- [x] **conduit** (9): (open), linetype, why12, ceiling, chain, fill, straps, read, (done)
- [x] **circuits** (8): (open), group, homerun, panelpoles, vd, load, cross, (done)
- [x] **equipment** (6): (open), three, poles, hood, dedicated, (done)
- [x] **service** (8): (open), oneline, read, feeder, rise, fill, gear, (done)
- [x] **whole** (6): (open), lay, compare, report, legend, (done)
- [x] **bid** (7): (open), open, rows, tick, proof, handoff, (done)

## The HVAC course  (features/course-hvac.js)

- [x] **before** (8): (open), set, estimator, verbs, header, sidebar, bottom, (done)
- [x] **sheet** (8): (open), what, scale, prove, unit, schedule, balance, (done)
- [x] **rooms** (7): (open), why, dining, needs, kitchen, deck, (done)
- [x] **diffusers** (7): (open), schedule, dining, rest, neck, grilles, (done)
- [x] **system** (4): (open), group, designed, (done)
- [x] **main** (8): (open), arm, trace, why, kitchen, attach, fittings, (done)
- [x] **plenum** (7): (open), scale, prove, depth, fits, static, (done)
- [x] **exhaust** (9): (open), grease, why, dampers, nodamper, restroom, makeup, interlock, (done)
- [x] **whole** (5): (open), lay, compare, copy, (done)
- [x] **bid** (7): (open), open, rows, tick, proof, handoff, (done)

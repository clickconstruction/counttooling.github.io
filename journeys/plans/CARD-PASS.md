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

**Now:** the lessons. `start` and `plans` are done; `scale` is next, card `(open)`.

### The six fixes, before the pass

- [x] 1. The plumbing tour ends with two Bid Check warnings it never mentions: a Bid Check card, and a takeoff that passes. DONE, the first half: a `bidcheck` card sits between `proof` and `handoff` (18 cards now). It opens BID CHECK, lights the two warning rows and says why each one warns (the x3 zone made the 1in pipe too small; the tour drew no hot water). The takeoff still warns on purpose: two real warnings read aloud teach more than a clean list. The hand-off card now says the copy asks first.
- [x] 2. The electrical course's homerun and feeder steps pass while the run is still a draft: require the run finished. DONE: both checks want no live draft; the circles still tick as the reader goes, and the card's line says "The path is in. Click Finish under the sheet to end the run".
- [x] 3. Each course's Chapter 0 follows Start here: one card per screen area, and no "how cards work" card. DONE in all three courses: `screen` / `where` became `header`, `sidebar` and `bottom`, each lighting its own area, and the `cards` card is gone. Openers and intros no longer count the cards.
- [x] 4. A card that opens with the last question's answer does two jobs: the answer shows on the question's own card. DONE: a step's new `answer` field (features/tutorial.js). Once the reader's click is right the card shows the answer in place of the task and waits for Next. 23 answers moved back to their question cards across the three courses, with the explanation that trailed them and their rule ids; the voltage-drop card asks a thinking question, so its answer waits behind a Show the answer button. The language check and the rules check read `answer` too.
- [x] 5. Cards about number keys have no tablet version: skipped on touch. DONE: a step's new `keys: true` flag (features/tutorial.js). On a tablet or a phone the tour leaves those cards out and counts its steps without them: counting `bind` and `usekey`, and `keys` in the plumbing and electrical courses. The blank-sheet tour keeps its card, which already has a touch version. The counting recap drops "a number key" on touch.
- [x] 6. The HVAC tour quotes 442 CFM where the screen reads 508: the number goes. DONE: the card says the four diffusers give 600 CFM, more than the office needs (the room's own figure depends on the box the reader drags, so the card no longer quotes it).

### The pass

Engine changes the pass has made so far, which every later card gets for free:
- On a touch screen "Click" reads "Tap", in the card and in its status line (`tapText`).
- The sheet is lit only as far as it shows (the ring no longer draws lines across the sidebar).
- A hands-off step's button can step aside (`action.show`): Sheets' opening card is two states.
- Tools for the pass, in the session scratchpad: `cardshots.js <lesson:id | tour id> <outdir> [tablet] [only ids]`
  walks an entry and prints each card with its chips, lit box and card box, and saves a screenshot;
  `testat.sh <log> <specs>` runs specs against HEAD in a second worktree (`card-pass-test`), so the
  tree being edited is never the tree under test.

Found on the way, fixed: the page badge was described the wrong way round in three cards (a yellow
NUMBER means the sheet has a scale, a yellow OUTLINE means it carries marks).

## The lessons (Start here, then the thirteen)  (features/lessons.js)

- [x] **start** (8): (open), header, sidebar, bottom, try, paths, words, (done)
- [x] **plans** (7): (open), jump, rotate, rename, marked, prepare, (done)
- [ ] **scale** (7): (open), set, prove, zone, provezone, more, (done)
- [ ] **counting** (7): (open), counter, place, bind, usekey, settings, (done)
- [ ] **measuring** (7): (open), snap, trace, bends, drop, read, (done)
- [ ] **chain** (5): (open), chain, hangers, rule, (done)
- [ ] **repeats** (4): (open), zone, read, (done)
- [ ] **organize** (8): (open), groupson, group, assign, filter, layer, hide, (done)
- [ ] **fixing** (6): (open), undo, context, details, area, (done)
- [ ] **notes** (6): (open), note, rfi, highlight, ledger, (done)
- [ ] **check** (7): (open), open, fix, tick, proof, legend, (done)
- [ ] **deliver** (6): (open), report, pdfs, tooling, email, (done)
- [ ] **speed** (5): (open), map, rail, rightclick, (done)
- [ ] **cloud** (5): (open), saved, share, bids, (done)

## The plumbing tour  (features/tutorial.js)

- [ ] **welcome** (1): welcome
- [ ] **scale** (1): scale
- [ ] **measure** (1): measure
- [ ] **counter** (1): counter
- [ ] **place** (1): place
- [ ] **linetype** (1): linetype
- [ ] **chain** (1): chain
- [ ] **drop** (1): drop
- [ ] **hangers** (1): hangers
- [ ] **waterside** (1): waterside
- [ ] **wsfu** (1): wsfu
- [ ] **size** (1): size
- [ ] **zone** (1): zone
- [ ] **rfi** (1): rfi
- [ ] **proof** (1): proof
- [ ] **bidcheck** (1): bidcheck
- [ ] **handoff** (1): handoff
- [ ] **done** (1): done

## The electrical tour  (features/tutorial.js)

- [ ] **welcome** (1): welcome
- [ ] **scale** (1): scale
- [ ] **measure** (1): measure
- [ ] **trade** (1): trade
- [ ] **counter** (1): counter
- [ ] **place** (1): place
- [ ] **linetype** (1): linetype
- [ ] **ceiling** (1): ceiling
- [ ] **chain** (1): chain
- [ ] **circuit** (1): circuit
- [ ] **summary** (1): summary
- [ ] **bidcheck** (1): bidcheck
- [ ] **handoff** (1): handoff
- [ ] **done** (1): done

## The HVAC tour  (features/tutorial.js)

- [ ] **welcome** (1): welcome
- [ ] **scale** (1): scale
- [ ] **measure** (1): measure
- [ ] **room** (1): room
- [ ] **counter** (1): counter
- [ ] **place** (1): place
- [ ] **system** (1): system
- [ ] **duct** (1): duct
- [ ] **attach** (1): attach
- [ ] **schedule** (1): schedule
- [ ] **bidcheck** (1): bidcheck
- [ ] **handoff** (1): handoff
- [ ] **legend** (1): legend
- [ ] **done** (1): done

## The blank-sheet tour  (features/tour-blank.js)

- [ ] **welcome** (1): welcome
- [ ] **scale** (1): scale
- [ ] **measure** (1): measure
- [ ] **move** (1): move
- [ ] **counter** (1): counter
- [ ] **count** (1): count
- [ ] **quickkeys** (1): quickkeys
- [ ] **linetype** (1): linetype
- [ ] **snap** (1): snap
- [ ] **polyline** (1): polyline
- [ ] **chain** (1): chain
- [ ] **drop** (1): drop
- [ ] **duct** (1): duct
- [ ] **highlight** (1): highlight
- [ ] **multiply** (1): multiply
- [ ] **scalezone** (1): scalezone
- [ ] **room** (1): room
- [ ] **ghost** (1): ghost
- [ ] **deletearea** (1): deletearea
- [ ] **note** (1): note
- [ ] **toggles** (1): toggles
- [ ] **undo** (1): undo
- [ ] **layers** (1): layers
- [ ] **pages** (1): pages
- [ ] **zoom** (1): zoom
- [ ] **sidebar** (1): sidebar
- [ ] **groups** (1): groups
- [ ] **summary** (1): summary
- [ ] **bidcheck** (1): bidcheck
- [ ] **settings** (1): settings
- [ ] **savestatus** (1): savestatus
- [ ] **exportmenu** (1): exportmenu
- [ ] **share** (1): share
- [ ] **exports** (1): exports
- [ ] **clearpage** (1): clearpage
- [ ] **close** (1): close
- [ ] **done** (1): done

## The plumbing course  (features/course-plumbing.js)

- [ ] **before** (8): (open), set, estimator, verbs, header, sidebar, bottom, (done)
- [ ] **sheet** (9): (open), what, scale, prove, keynotes, schedule, row, units, (done)
- [ ] **fixtures** (10): (open), wetwall, counters, restrooms, handsinks, kitchen, floorsinks, primers, keys, (done)
- [ ] **water** (12): (open), service, trunk, linetypes, trace, hot, chain, drop, hangers, bends, read, (done)
- [ ] **waste** (12): (open), downhill, two, layer, linetypes, ss, gw, cleanouts, vents, open, underslab, (done)
- [ ] **riser** (8): (open), scale, prove, traparm, stack, why, co, (done)
- [ ] **gas** (9): (open), meter, linetype, trace, bends, drops, hood, hangers, (done)
- [ ] **details** (8): (open), why, scale, prove, zone, multiply, read, (done)
- [ ] **whole** (6): (open), lay, compare, legend, pdfs, (done)
- [ ] **bid** (8): (open), open, rows, tick, proof, ledger, handoff, (done)

## The electrical course  (features/course-electrical.js)

- [ ] **before** (8): (open), set, estimator, verbs, header, sidebar, bottom, (done)
- [ ] **sheet** (9): (open), what, scale, prove, panel, clearance, schedule, row, (done)
- [ ] **devices** (8): (open), gfci, missed, duplex, heights, jbox, keys, (done)
- [ ] **lighting** (7): (open), schedule, plan, power, os, why, (done)
- [ ] **conduit** (9): (open), linetype, why12, ceiling, chain, fill, straps, read, (done)
- [ ] **circuits** (8): (open), group, homerun, panelpoles, vd, load, cross, (done)
- [ ] **equipment** (6): (open), three, poles, hood, dedicated, (done)
- [ ] **service** (7): (open), read, feeder, rise, fill, gear, (done)
- [ ] **whole** (6): (open), lay, compare, report, legend, (done)
- [ ] **bid** (7): (open), open, rows, tick, proof, handoff, (done)

## The HVAC course  (features/course-hvac.js)

- [ ] **before** (8): (open), set, estimator, verbs, header, sidebar, bottom, (done)
- [ ] **sheet** (8): (open), what, scale, prove, unit, schedule, balance, (done)
- [ ] **rooms** (7): (open), why, dining, needs, kitchen, deck, (done)
- [ ] **diffusers** (7): (open), schedule, dining, rest, neck, grilles, (done)
- [ ] **system** (4): (open), group, designed, (done)
- [ ] **main** (8): (open), arm, trace, why, kitchen, attach, fittings, (done)
- [ ] **plenum** (7): (open), scale, prove, depth, fits, static, (done)
- [ ] **exhaust** (9): (open), grease, why, dampers, nodamper, restroom, makeup, interlock, (done)
- [ ] **whole** (5): (open), lay, compare, copy, (done)
- [ ] **bid** (7): (open), open, rows, tick, proof, handoff, (done)

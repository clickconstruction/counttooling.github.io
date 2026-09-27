# PERSONA-PASS, 2026-09-26: the digest

The first full persona pass over every teaching set, run as PERSONA-PLAN.md lays it out: a text pass
by Haiku personas, a live pass on the steps it flagged (one step per episode, the prober beside the
personas, the harness's no-work sweep on every doing step), the merge, and a replay of every
group worth one by a stronger model on the current tree. Findings only: the prompts are in
scripts/persona-prompts/, the method and what to change next time in PERSONA-PLAN.md "Pass 1
results (2026-09-26)", and what landed in CHANGELOG.md "fix(persona): the first full persona pass".

## The numbers

| | |
|---|---|
| Sets | 44: the three five-minute tours, the blank-sheet tour, the 13 lessons, the 27 course chapters |
| Steps | 373, 265 of them doing steps |
| Text pass | 5 persona kinds × 44 sets = 220 readings, 1,048 findings (644 gap, 296 wording, 53 suggestion, 30 code-claim, 14 stall, 11 false-pass) |
| Flagged for the live pass | 21 doing steps in 16 sets (a stall, wording or false-pass that 3 persona kinds wrote, or 2 with a stall or false-pass; a wording finding whose control IS in the label index did not count, 145 of them) |
| Live pass | the 21 steps × 4 devices (first-timer, returning, laptop 1280 × 720, tablet): 51 findings (43 stall) |
| Prober | every doing step of the 16 flagged sets, 99 steps, about 290 probes: 37 findings (34 false-pass); 12 were a Skip, which leaves a step and never passes it, dropped before replay |
| No-work sweep | 265 doing steps × 2 devices, no model: 1 flag |
| Merge | 1,121 findings, 896 groups |
| Replayed | 212 groups (every live, prober and no-work group; text groups with 2+ persona kinds or severity 3): **63 real, 117 false lead, 31 opinion, 1 trade question** |
| Real, by kind | 27 wording, 16 false-pass, 13 gap, 7 stall; about 30 distinct mechanisms once one cause is counted once |
| Precision | 30% of replayed groups real (text 36 of 145, 25%; live and prober 27 of 67, 40%) |

## Real, and fixed on this branch

**Checks that passed the wrong thing** (the prober's yield; each reached the bid or made the next
cards read another takeoff):
- Plumbing tour `linetype`: any fresh line type passed; a 2in or a Copper type broke the hanger and
  size cards. Now 1in PEX, with a hint naming what was made.
- Electrical tour `linetype`: any raceway and any conductors passed (1/2", RMC, 2 #12). Now EMT,
  3/4" and 3 #12 + 1 #12 G, the hint naming the part that is off. `counter`: a Single Pole
  receptacle (48" mount) passed; now the duplex. `ceiling`: any height passed; now 10'-0".
- HVAC tour `counter`: any CFM passed; now 150. `room`: any room type, ceiling and deck passed;
  now Office, 9 and 12, each with its hint.
- The electrical and plumbing tours' `place` steps: a stray mark outside the circles stayed in the tally and the step
  passed anyway. The step now waits until it is undone, and the hint says it counts.
- HVAC course `main:arm`: Insulation left at None passed; now Wrap.
- The proof steps (lesson Check, and the three courses' `bid:proof`): any SUMMARY row's breakdown
  passed, the first (Lavatory) included. Now the row the card names, with a hint.
- Lesson Fixing `area`: a Delete area box over the whole plan passed; now the kitchen drains must
  survive it.

**Wording** (the harness or the source reproduced it):
- The three courses' `whole:lay` promised "click Show me where and then its button": no such
  button exists since the no-do-it-for-me rule. Gone, and "the status line", an engine word no card
  defined, is now "the line beside Show me where on this card".
- The Bid Check `tick` cards (lesson Check and the three courses) said "In BID CHECK", so the tablet
  rewrite never told the reader to open the ☰ drawer; they now start "In the left sidebar", and say
  one click signs the row for the whole bid (the prober read "on every counted sheet" as per sheet).
- HVAC tour `duct` and course `main:trace`: "tap the suggestion (spiral first, then the rectangular
  twin)" and "press S, and tap the size" named nothing on screen. The cards now say S opens the Duct
  size box, and which row to click. `bidcheck` lit the first manual row (Fire dampers), below the
  fold at 1280 × 720; it lights Curb & power now. `main:why` said "four times" of three step-downs,
  and its reveal claimed the ductulator agreed with every printed size (it does not: see the tester
  rows).
- Box steps said "anywhere inside the shaded boundary", but a box whose corners sit inside the
  dashed line fails. Six cards and the hint now say "in the shaded band, outside the dashed line".
- The lessons' opening step lit the header's Upload PDF (a file picker with no lesson PDF in it)
  while the card names its own button; it lights nothing until Trim your set is up.
- Electrical course `circuits:homerun` pointed at another type's settings; it states them.
  Electrical tour `ceiling` used "make-up" without its 1 ft. HVAC course `exhaust`: "the airside
  chip Exhaust" is "Airside Exhaust", as the dialog labels it.
- Plumbing course `riser:co`: a reader starting at chapter 5 has no CO Cleanout and only a
  parenthesis; the card gives the route. `gas:hangers`: the first hand-typed child-count row named
  none of the form's fields; it names them.
- Lessons: Counting defines "arm" where it first appears and gives the tablet route to Counter
  Settings; Notes gives the tap path for a second note and calls the RFI filter [[RFI]], not a chip;
  Organize says "the COUNTERS list", not "the palette", and lets the layer take any name (the check
  never read it); Repeats names the multiplier field (a tablet does not focus it); Deliverables says
  what PipeTooling and TakeoffTooling are.

## Real, but a trade call first

The replay found these, and each is already an item in a TRADE row that says someone with the trade
settles it before anyone edits it, so this branch left them alone: the two 208 V two-pole circuits
on E-501 and "every other circuit is #12" (EC-TRADE), the service `rise`'s 5 ft against the heights
it quotes (EC-TRADE), the leftover "Spiral round in ten-foot sticks" at the top of `exhaust:makeup`
and where the main changes size (HC-TRADE), the gas hangers' 12 ft (PC-TRADE), and the trap arm's
IPC Table 1002.2 (PC-TRADE, and one of the 29 RULEBOOK-GAPS). The pass rediscovered them without
the list: a recall signal for the method, not a new row.

## Tester questions

- The HVAC course's main: at the 20x12 and 16x10 corners the Duct size box's SUGGESTED row read
  22"Ø / 26×16 from 2,550 CFM, not the printed sizes. Is the sample's sizing, the ductulator's
  0.08" per 100 ft, or the course's air per room the one to trust? (row PP-DUCT-SUGGEST)
- The electrical course's `lighting:os` passes with extra OS marks on plain S switches: its check
  reads only that the three doors are marked. (row PP-OS-STRAY, an agent can fix it)

## Calls

- One name for the upload dialog: signed in, it is "Prepare PDF for Cloud" with a Save & open
  beside Open, while every lesson card calls it Trim your set. (row PP-TRIM-TITLE)
- A course's `whole` chapter skipped leaves the sheets without marks, so its report and compare
  cards name a Show Report that is not there. Seed a minimal takeoff on Skip, or say so on the card.
  (row PP-WHOLE-SKIP)
- The Duct tool's plan-size chip says "S accepts"; S opens the size box, where the size is a second
  click. Make S take the plan's size, or reword the chip. (row PP-DUCT-CHIP)

## Drafts

- A "Words the cards use" section in the Learn guide (content/guides/learning-the-app.md): armed,
  the line beside Show me where, the palette, a chip. Its box bullet now says how the shaded band
  and the dashed line work.
- No draft rule: every code citation the pass questioned is one of the 29 RULEBOOK-GAPS (being
  drafted on other branches: IPC 1002.2 trap arms, IPC 308.5 steel hangers, NEC 110.26 working
  space, NEC 210.8(B) GFCI, IMC 403 outdoor air, the 400 to 600 fpm neck velocity) or already in
  a TRADE row.

## What was false

117 of 212. The classes, largest first:
- **A label built at run time or drawn as a glyph**, missing from the text pass's label index:
  Category, Variant and Rating (the Quick tab renames Size, Type and Material for an electrical
  project), the ✎ pencil, the ⋯ button, the Bid Check row words. About 30.
- **The card's own button taken for a missing control** ("Open the lesson sheets"), though the
  index lists it as a card label. About 15.
- **A live persona's budget** (4 calls) running out on a step of eight actions, or guessing where a
  course mark is on a sheet that draws no circle by design (a find-it question). About 35.
- **A harness quirk**: a select option written 3/4" matched against "3/4 inch", 20×12 against
  20x12, no right-click until this pass added one.
- **Opinion**: a trade word in a trade course, used in a paragraph after the course explains it.
- The no-work sweep's one flag, the blank tour's `savestatus` signed out, is by design: with no bell
  the step is a read that waits for Next.

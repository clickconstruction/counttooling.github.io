# Tester dossier, HVAC: the course's findings, the duct suggestion and the four drafts

> Researched 2026-09-26 for the person with the trade who settles four punch rows: HC-REVIEW,
> HC-TRADE, PP-DUCT-SUGGEST and the HVAC four of RULEBOOK-SIGN. This is the research half only.
> The house rule (PERSONA-PLAN.md "Who does what") is that code and trade truth is settled by a
> person with the trade, never by an agent's edit, so nothing here changed a card, a rule, a sheet
> or the code, and no row is closed. You confirm or reject; the edits follow in the same commit
> as your answer.
>
> How to read an entry: **the claim** (file and step id, or rule id), **what the app computes**,
> **what the public text says** (with what could and could not be opened), a **recommendation**
> with a **confidence**, and **what you still decide**. Numbers were read from the running app
> (the course's own steps driven through its seam on a local server, 2026-09-26) or from
> duct-model.js's exports under Node. Coordinates are plan px from scripts/sample-hvac.js
> (12 px to the foot).
>
> Sources that opened: the NC Office of the State Fire Marshal's interpretation of NCMC 607.5
> (2018 NC Mechanical Code, which keeps the IMC's numbering); the Seattle 2021 Mechanical Code
> chapter 4 (IMC 2021 with Washington amendments, table rows tagged [W]); Washington's WAC
> 51-52-0403 table; an older IMC Table 403.3 extract (CUNY course notes); UpCodes pages for
> Illinois' 2024 IMC 508 and 506.3.9, NYC's 2022 grease duct enclosure section, Minnesota's
> Rule 1346.0508; Nailor's and Sheet Metal Journal's diffuser selection notes; kitchenventilation.com
> on ceiling registers near hoods. Sources that did not open: codes.iccsafe.org (403 to the
> fetcher; its section titles came back through search only), up.codes' model IMC 2021 viewer
> (404), NFPA 96 (needs a login), SMACNA and ASHRAE 62.1 text (paywalled). Where an entry leans
> on one of those, it says "from memory".

## PP-DUCT-SUGGEST: why the SUGGESTED row reads 22"Ø / 26×16

### P1. The number is the downstream air, not the friction rate and not the sheet

**The claim.** PERSONA-PASS-2026-09-26.md "Tester questions": at the HVAC course main's 20x12 and
16x10 corners (features/course-hvac.js, `main:trace`), the Duct size box's SUGGESTED row read
22"Ø / 26×16 from 2,550 CFM, not the printed sizes. Is the sample's sizing, the ductulator's
0.08" per 100 ft, or the course's air per room the one to trust?

**What the app computes.** Reproduced on the running app, chapter `main`, step `trace`, the Duct
tool at 24x12, clicks at the printed points:

| Where the trace is | SUGGESTED row | downstream / total / served |
|---|---|---|
| the RTU-1 drop (904,328) and the hall corner (904,282) | 22"Ø or 26×16 from 2,650 CFM | 2,650 / 2,650 / 0 |
| the 20x12 change (560,282) | 22"Ø or 26×16 from 2,550 CFM | 2,550 / 2,650 / 100 |
| the 16x10 change (420,282) | 22"Ø or 26×16 from 2,550 CFM | 2,550 / 2,650 / 100 |
| the 12x10 change (300,282) | 22"Ø or 26×16 from 2,550 CFM | 2,550 / 2,650 / 100 |

The chain: features/duct-suggest.js `getDuctDraftSuggestion` asks duct-model.js
`ductDraftRemainingCfm` for the air still downstream, then `suggestRoundAndRect` sizes it at the
project's `frictionInPer100ft` 0.08 and `maxVelocityFpm` 1,200 (`DUCT_SETTINGS_DEFAULTS`). The
remaining air is the system's device CFM minus what is served, and **a device not attached to any
run counts as "assumed downstream of this trace"** (duct-model.js ~1326). In chapter 5 the trace
comes before the attach step, so every diffuser is a stray: the dining SD-1s sit 72 plan px
(6 ft) off the main, the attach snap is 12 PDF points (16 plan px). The only device the trace
passes is the hall SD-2 at (800,282), which sits on the main line: 2,650 − 100 = 2,550, at every
corner. The kitchen's 800 (its tap at 572 is upstream of 560), the back run's 250 (a separate run
from the RTU drop) and every dining diffuser already passed all stay in the number.

At 0.08"/100 ft, 2,550 CFM needs 20.7" round by friction (19.7" by the 1,200 fpm cap), stocked
up to 22"Ø; its rectangular twin is 26×16 (De 22.1"). So the row is the ductulator answering a
wrong question correctly.

The true air in each stretch, from the plan (taps where the flex and branches leave):

| Stretch | Carries | 0.08" suggests | Printed | Printed size at its air |
|---|---|---|---|---|
| 24x12, RTU to the hall SD-2 | 2,400 (all but the back run's 250) | 22"Ø / 26×16 | 24x12 | 0.133"/100 ft, 1,200 fpm |
| 20x12, from 560 | 1,500 (dining 1,200 + the bar's 300) | 18"Ø / 20×14 | 20x12 | 0.083"/100 ft, 900 fpm |
| 16x10, from 420 | 1,200 | 16"Ø / 16×14 | 16x10 | 0.150"/100 ft, 1,080 fpm |
| 12x10, from 300 | 900 to the bar tap, 300 past it | 14"Ø / 14×12 | 12x10 | 0.174"/100 ft at 900 |

**What the public text says.** Nothing to open: this is arithmetic. The friction fit
(f = 0.109136·Q^1.9/D^5.02) and De = 1.30(ab)^0.625/(a+b)^0.25 are the standard ASHRAE chart fit
and Huebscher equivalent, both cited in duct-model.js; I checked them against the anchors in
duct-model.test.js, not against a published chart.

**Recommendation.** The explanation is none of the three as asked: the SUGGESTED row is wrong
because of the course's order (trace, then attach) meeting the app's stray rule. That half is an
agent item (see A4). The friction rate is fine and the sheet is partly off (P2). Confidence:
**high** (reproduced, and the arithmetic closes to the CFM).

**What you still decide.** Nothing on P1 itself; P2 is yours.

### P2. The printed main past the hall agrees with 0.08 only if the bar's 300 CFM is left off it

**The claim.** scripts/sample-hvac.js `DUCT.main.sizes` prints 24x12, 20x12, 16x10, 12x10;
`main:why` says the engineer sized "at a friction rate that keeps the fan's pressure within the
unit (0.08" per 100 ft here)" and that the far end carries 600.

**What the app computes.** From the table above, at 0.08: 20x12 agrees (1,500 CFM at 0.083");
16x10 and 12x10 run near twice the rate; 24x12 runs at 0.133" and exactly the 1,200 fpm cap, so it
reads as velocity-sized, not friction-sized. Drop the bar's 300 from the main and every size
past the hall lands: 16x10 at 900 CFM is 0.087", 12x10 at 600 is 0.080" (the 600 the card
quotes), 20x12 at 1,200 is 0.055"; the 24x12 at 2,100 still runs at 0.10".
The bar branch (`DUCT.bar`, 10x8 from (260,282)) taps the main inside the 12x10 stretch, so its air does pass through the 20x12, 16x10 and the first 3 ft of the 12x10.

At 0.08 the stretches would be 32x12 (or 26×16), 22x12, 18x12 (or 22x10) and 18x10 (or 14x12),
keeping the depths. The M-101 keynotes print no friction rate: the "0.08 here" is the card's,
not the sheet's.

The Static path row is barely moved by it: the critical path's straight duct (63 ft) is 0.061"
at the printed sizes' true friction against 0.051" at the flat 0.08 the row assumes; the row
passes either way (0.21" of 1.0" in chapter 5).

**What the public text says.** Nothing public sets a friction rate; 0.08 to 0.10"/100 ft is the
common low-pressure design range (from memory, ASHRAE Fundamentals duct design chapter; not
opened).

**Recommendation.** Needs the trade's judgment. My lean: either resize the sample's 16x10 and
12x10 (and say the 24x12 is velocity-limited), or keep the sheet and change `main:why` to say the
engineer sized this main at about 0.15"/100 ft and the ductulator at 0.08 will read bigger.
Confidence: **medium** (the arithmetic is certain; whether 0.15" and 1,080 fpm over a dining
ceiling is a normal restaurant design is your call).

**What you still decide.** Is a 0.13 to 0.17"/100 ft main at about 1,100 fpm above a dining room
a size an engineer would print? If yes, the card changes; if no, the sheet changes (and chapter 8's
reference feet, the transitions and the bid weight move with it).

## HC-TRADE: the 2026-09-24 trade findings

Detail: HVAC-COURSE.md "Trade findings from the 2026-09-24 read".

### T1. The 8" neck "whistles" at 200 CFM

**The claim.** features/course-hvac.js `diffusers:neck` reveal: 150 CFM through an 8" neck is
about 430 fpm, "push 200 through it and it whistles", the trade's rule of thumb runs 400 to 600
fpm at a neck. Rule `hvac.diffuser.neck-velocity` carries the same band.

**What the app computes.** 200 CFM through 8" is 573 fpm (inside the card's own band); SD-3's
10" at 200 is 367 (below it); SD-2's 6" at 100 is 509; EG-1's 6" at 75 is 382.
`NECK_SIZE_TABLE` tops out at about 430, 550, 573 and 655 fpm. By the app's own friction fit an
8" round carries 207 CFM at 0.08"/100 ft, a 10" 372.

**What the public text says.** Nailor, "How ceiling diffusers are selected" (2022): "keep your
neck velocity below 1000 fpm", with selection from the maker's catalogued NC and throw data; Sheet
Metal Journal repeats the 1,000 fpm figure. I found no public source for 400 to 600 or 300 to 500
as the trade's band.

**Recommendation.** Change: drop "whistles" and the 400 to 600 band. A 24x24 on an 8" neck at
200 CFM is a quiet selection by any published figure. Say instead that the engineer picks the neck
from the maker's sound data and the runout's pressure, and on this sheet the 10" also matches the
flex that feeds it (see R6). Confidence: **medium** (sources are makers' guidance, not code; your
shop may use a tighter number).

**What you still decide.** What sets SD-3's 10" in your experience (sound, the runout's pressure
drop, throw), and whether the card should quote any number at all.

### T2. Exhaust and make-up air counted on RTU-1's capacity

**The claim.** `exhaust:makeup` and chapter 8's `layRun`: new runs take the active group, RTU-1,
and designed air adds supply and exhaust alike, so "Systems within capacity" warns against what
chapter 4 taught.

**What the app computes.** Confirmed with a different number than the finding: after chapter 7's
steps, RTU-1 reads **4,575 designed / 3,000 capacity ⚠** (2,350 from chapter 5, plus MA-1's 2,000
on the make-up run, plus EG-1's 225 on the restroom exhaust; the finding's 4,875 assumed the bar's
300 was attached, and in chapter 7 it is not). After chapter 8's "Finish the takeoff for me" all
seven runs, the two exhaust runs and the make-up run included, carry RTU-1, and the row reads
**0 designed / 3,000 ✓** with the Static path walking the 28 ft restroom exhaust. Both readings
are wrong; the second is an app item (A2).

**What the public text says.** No code text rules on an app's system grouping. IMC 508.1 balances
make-up air against exhaust for the whole building ("approximately equal to the amount of exhaust
air for all exhaust systems for the building", Illinois' 2024 adoption on UpCodes); a rooftop
unit's schedule capacity is its supply fan's airflow (M-501: RTU-1 3,000 CFM at 1.0" ESP; EF-1,
MAU-1 and EF-2 each have their own CFM and ESP).

**Recommendation.** Keep chapter 4's teaching; the app is what is wrong. In the trade exhaust is
never on a supply unit's capacity, and MAU-1, EF-1 and EF-2 are each their own system with their
own capacity. Confidence: **high**.

**What you still decide.** Confirm that each fan is its own system (a product call follows on how
the app should assign a new exhaust or make-up run, row A3), and whether MA-1's 2,000 should show
anywhere against RTU-1 at all (my read: no; it belongs to MAU-1).

### T3. Where the main changes size

**The claim.** `main:trace` says "click the corner, press S" at 20x12 where the run is straight,
and each size label is printed about 60 px (5 ft) downstream of its change, so a reader clicks at
the label and chapter 8's feet by size drift.

**What the app computes.** scripts/sample-hvac.js puts each change at a vertex (560, 420, 300 on
y=282) and each callout at x − 60 (500, 360, 240). The taps: the kitchen branch at 572, the
dining flex pairs at 520, 410, 300, 190, the bar branch at 260. So the vertices sit just after the
tap that took the air (560 after the kitchen, 420 after the 520 pair, 300 at the 300 pair), and the
labels sit after the next pair. A change clicked at the labels moves 5 ft from each smaller size
into the larger: 20x12 about 16.7 ft instead of 11.7, 12x10 about 5 instead of 10. 560 is not a
corner: the hall run is straight there.

**What the public text says.** Nothing public; drafting convention (from memory) is a transition
symbol at the change, placed just downstream of the takeoff whose air made it.

**Recommendation.** Keep the vertex positions (reduce after the tap), and move each callout onto
the change or draw a transition symbol there; reword "the corner" to "where the size changes".
Confidence: **medium**.

**What you still decide.** Where you would expect the reducer relative to the diffuser taps, and
whether the sheet should draw transition symbols at all.

### T4 and T5. The counts in the words, the leftover spiral line, the MAU-1 drop

Not trade truth, except one question: `exhaust:makeup` says to click "the MAU-1 drop at the east
wall", and M-101 draws no drop symbol at (904,372), only the leader to the roof key; RTU-1's drop
has a dashed square. **You decide** whether a roof make-up unit's discharge should show the same
penetration symbol (my lean: yes, confidence **medium**). The rest is in the agent list (A5).

## HC-REVIEW: chapters 2 to 7 and M-501, read as an estimator

Scope: chapters 2 to 7, M-501's room air and diffuser schedules. Two entries (R1, R15) sit on the
same sheets outside those chapters and are kept here because a mechanical estimator reads them
together.

### R1. The air balance adds recirculated supply to make-up air

**The claim.** M-101 keynote (scripts/sample-hvac.js `sheetM101`): "AIR BALANCE: SUPPLY 2,650 +
MAKE-UP 2,000 · EXHAUST 2,400 + 225: BUILDING SLIGHTLY POSITIVE"; chapter 1 `sheet:balance`
repeats the sum.

**What the app computes.** Nothing; the keynote's sum is 4,650 in against 2,625 out, 2,025 CFM
positive, which is not slight. RTU-1's 2,650 is mostly return air from the plenum; only its outdoor
air counts toward building pressure. By IMC Table 403.3.1.1 rates the zones want about 1,200 CFM of
outdoor air at the breathing zone (dining 77 people × 7.5 + 1,104 × 0.18 ≈ 778; bar ≈ 243; kitchen
≈ 124; the rest ≈ 60), so RTU-1 likely takes 1,200 to 1,500 CFM outside. Then in is about 3,200 to
3,500 against 2,625 out: positive, but by the OA, not the supply. M-501's equipment schedule has no
OA column.

**What the public text says.** IMC 508.1 (Illinois 2024 on UpCodes): make-up air from all sources
approximately equal to all exhaust for the building. IMC 403.1 (Seattle 2021 and the older extract):
supply approximately equal to return plus exhaust. Table rates as above (Seattle 2021, WAC 51-52).

**Recommendation.** Change the keynote and the card to balance outdoor air: "OA from RTU-1 (per the
schedule) + make-up 2,000 against exhaust 2,625", and add an OA CFM column to RTU-1's schedule row.
Confidence: **high** that the arithmetic as printed is wrong; **medium** on the OA figure.

**What you still decide.** The RTU-1 OA number to print, and whether the building should read
"slightly positive" with it.

### R2. "The larger wins": ventilation is outdoor air, not supply

**The claim.** `rooms:why` reveal: a room's CFM comes from two things, "the cooling load … and the
ventilation the code requires … and the larger wins".

**What the app computes.** Dining: supply 1,200 against about 778 of outdoor air. The cooling load
sets the supply; the ventilation minimum sets how much of that supply is outside air.

**What the public text says.** IMC 403.2.1 (Seattle 2021): the outdoor air required "shall not be
recirculated"; air above it may be. The rates are outdoor air to the breathing zone.

**Recommendation.** Change to: supply comes from the cooling load; the code's ventilation says how
much of it must be outside air, and only in a crowded room with a small load does the ventilation
push the supply up. Confidence: **medium** (the "larger wins" line is right in rare zones, wrong as
the general rule).

**What you still decide.** The wording.

### R3. Dining at 7.5 CFM a person plus 0.18 a square foot

**The claim.** `rooms:why`: "IMC 403, from ASHRAE 62.1: a dining room at 7.5 CFM per person plus
0.18 per square foot".

**What the public text says.** Seattle 2021 Table 403.3.1.1 and the older IMC Table 403.3 both read
dining rooms 70 per 1,000 sq ft, 7.5 cfm/person, 0.18 cfm/sq ft.

**Recommendation.** Sign as is. Confidence: **high**.

**What you still decide.** Nothing.

### R4. The mop room exhausts 75 CFM; the table wants about 116

**The claim.** M-501 room air schedule: MOP 104, 116 sq ft, exhaust 75, served by EF-2.

**What the public text says.** Seattle 2021 and WAC 51-52 Table 403.3.1.1: janitor closets, trash
rooms, recycling rooms, exhaust 1.0 cfm/sq ft (the row carries Washington's [W] tag, so the base
IMC figure may differ; ASHRAE 62.1 Table 6-4 reads 1.0 from memory). An UpCodes summary of
Wisconsin's 2021 table gave 2.0 cfm/sq ft or 75 per sink; I could not read the table itself, so
treat that as unverified. MEN 102 and WOMEN 103 each have one water closet on the restaurant shell,
so 75 each covers the public toilet row's 50 / 70 per fixture.

**Recommendation.** Change MOP to 116 (EF-2 to about 266) or name the rate the engineer used.
Confidence: **medium** (the rate varies by edition and amendment).

**What you still decide.** The rate your adopted code gives a janitor closet, and whether EF-2's
225 moves.

### R5. Note 4 cites the table for transfer air

**The claim.** M-501 note 4: restrooms exhaust only, air drawn from the hall under the doors
"(IMC 403, TABLE 403.3.1.1)".

**What the public text says.** Transfer air as make-up for toilet exhaust is IMC 403.2.2 (Seattle
2021 and the older extract, both "Transfer air"); the table only sets the exhaust rates.

**Recommendation.** Change the citation to "IMC 403.2.2, rates per Table 403.3.1.1". Confidence:
**high**.

**What you still decide.** Nothing beyond the wording.

### R6. One flex size for three neck sizes

**The claim.** M-101 keynote: "FLEX DUCT 8"ø, 6'-0" MAX, TO EACH DIFFUSER FROM A TAP W/ DAMPER"
(also M-501 note 5, the legend); M-501's diffuser schedule gives necks of 6" (SD-2), 8" (SD-1) and
10" (SD-3); `diffusers:neck` says "the flex that feeds it follows the neck".

**What the app computes.** An 8" flex into a 10" neck needs an increaser at every kitchen diffuser;
into a 6" neck a reducer. At 0.08 an 8" carries 207 CFM (galvanized; flex runs rougher).

**What the public text says.** Nothing public; from memory, runouts match the neck.

**Recommendation.** Change the keynote to "FLEX TO MATCH THE NECK" (6", 8", 10" by the schedule),
which also gives T1 its real reason. Confidence: **medium**.

**What you still decide.** Whether the keynote or the neck sizes are the error.

### R7. 2,000 CFM of make-up air through one 24x24 register drawn as a four-way diffuser

**The claim.** M-501: MA-1, "MAKE-UP AIR REGISTER, 24X24", neck 20X16, 2,000 CFM; M-101 draws it
with the supply diffuser's four-way symbol at (640,372), about 16 ft from the hood collar.

**What the app computes.** 900 fpm through the 20x16 neck; about 500 fpm across a 24x24 face
before free area.

**What the public text says.** kitchenventilation.com (a hood maker's design pages): "not to exceed
70 FPM at the face of the hood", and four-way diffusers near a hood push the plume down; the
California CKV Design Guide 3 (search summary only) warns against four-way and slot diffusers
near hoods.

**Recommendation.** Needs the trade's judgment. My lean: a make-up register at this flow is more
often a perforated plenum or several registers, or make-up delivered at the hood; the sheet's single
four-way-drawn register would draw a question on review. Confidence: **low** (16 ft away may be
fine; it depends on the hood and the throw).

**What you still decide.** Whether MA-1 as drawn is a plausible engineer's detail, and if not, what
the sample should show (it changes chapter 7's count, not its lesson).

### R8. `main:why` names a design friction the sheet never prints

**The claim.** `main:why`: "at a friction rate that keeps the fan's pressure within the unit (0.08"
per 100 ft here)".

**Recommendation.** See P2: the printed main is sized nearer 0.15". Change the card or the sheet,
your call there. Confidence: **high** that the card and sheet disagree.

### R9. The Static path row and "the far dining diffuser"

**The claim.** `plenum:static`: the row walks the longest path and "Here it passes: the far dining
diffuser is under an inch of water away".

**What the app computes.** Chapter 5 and 6 state: "RTU-1: 0.21" of 1.00" ESP · critical path 134 eq
ft (72' duct + 2 elbows + 1 tap + 1 VD @ 0.08"/100' + 0.10" terminal) ✓". Every foot is priced at
the 0.08 knob, not the drawn size's real friction; on this path that understates the straight duct
by about 0.01" (P2). Chapter 8's full takeoff reads a different path (A2).

**What the public text says.** Nothing public for the method. ESP on a schedule is external to the
unit: supply and return duct, diffusers, grilles (from memory).

**Recommendation.** Sign the teaching; the verdict holds with margin. Confidence: **medium**.

**What you still decide.** Whether 0.10" for the diffuser plus flex (the rule's terminal allowance)
matches what you carry.

### R10. The plenum and the wrapped main

**The claim.** `plenum:fits`: 1'-4" is twelve inches of duct and two of wrap each side, under a
3'-0" plenum. M-601 note 2: 1'-8" to spare.

**What the app computes.** Fits the roof reads "24×12 + 4" wrap = 16" · plenum 36" ✓" in chapter
5 and 6. On the full takeoff the deepest item is the 18" round grease duct, "18"Ø = 18" · plenum
36" ✓".

**Recommendation.** Sign. Confidence: **high**. One question for you: the section hangs the main
10" below the deck; with bar joists in that zone an estimator may want the joist depth noted. Low
stakes.

### R11. The grease duct's "listed wrap" is not what the keynote calls for

**The claim.** `exhaust:nodamper` reveal: where a grease duct passes a rated wall it gets a listed
enclosure or wrap, "and that is the wrap the keynote already calls for"; `exhaust:why` says the
Schedule prices 47 sq ft of listed wrap for this run.

**What the app computes.** The keynote reads "18" CLEAR OF COMBUSTIBLES, UP TO EF-1 (NFPA 96, IMC
506)" and calls for no wrap; the only wrap on the set is the supply's 2" fiberglass. The Grease duct
block still prices 47 sq ft.

**What the public text says.** NYC 2022 Mechanical Code 506.3.10 (UpCodes; the IMC text as NYC
adopts it): a grease duct that penetrates a ceiling, wall, floor or concealed space is enclosed from
the first penetration to the outlet, by a shaft, a listed field-applied enclosure (ASTM E 2336) or a
factory-built one (UL 2221), with an exception where the duct penetrates only a non-rated roof and
ceiling assembly. This restaurant is one storey and the sheets rate no roof or ceiling.

**Recommendation.** Needs the trade's judgment. Either the keynote gains a listed enclosure (and
the 47 sq ft stays) or the exception applies, the keynote's 18" clearance is the protection, and the
card stops saying the keynote calls for wrap. Confidence: **high** that the card misreads the
keynote; **low** on which way the sheet should go.

**What you still decide.** Wrap or clearance on this grease duct; the Schedule's wrap line follows.

### R12. Grease duct cleanouts every 12 ft

**The claim.** `exhaust:why` and the applied rule `hvac.duct.grease-duct`: a cleanout at each change
of direction and one per 12 ft of horizontal run (NFPA 96 7.4).

**What the public text says.** Illinois' 2024 IMC 506.3.9 (UpCodes): horizontal cleanouts "not more
than 20 feet" apart and not more than 10 ft from a change of direction over 45 degrees. NFPA 96's
12 ft (search summaries; NFPA not opened).

**Recommendation.** Keep 12 ft (the stricter, and the plan cites NFPA 96), but the card could say
the IMC allows 20. Confidence: **medium**. This rule is applied and outside the four drafts.

**What you still decide.** Which spacing your AHJ enforces.

### R13. The fire damper section cited is the one for fire walls

**The claim.** `exhaust:dampers` body and M-101's keynote: "IMC 607.5.1 wants a listed fire damper
wherever a duct goes through" the kitchen's one-hour hall wall.

**What the public text says.** NC OSFM interpretation of NCMC 607.5 (2018, IMC numbering): 607.5.1
is fire walls (no exceptions), 607.5.2 fire barriers (three exceptions), 607.5.3 fire partitions
(four exceptions). ICC's 2021 IMC section titles, seen through search: "607.5.2 Fire barriers",
"607.5.3 Fire partitions". A one-hour interior wall in a restaurant is a fire barrier or a fire
partition, not a fire wall.

**Recommendation.** Change the card and the keynote to "IMC 607.5" (or 607.5.2 / 607.5.3 once the
wall's classification is named). Confidence: **high**. Same fix as S3.

### R14. Two dampers, unless an exception removes them

**The claim.** `exhaust:dampers` and `exhaust:nodamper`: two dampers, one at each penetration.

**What the public text says.** NC OSFM, same document: a fire barrier or fire partition rated one
hour or less, in a building sprinklered throughout (IBC 903.3.1.1 or .2), penetrated by a "ducted
HVAC system" of at least 26 gauge steel continuous to the terminals, needs no fire damper (607.5.2
exception 3, 607.5.3 exception 4); a corridor wall in a sprinklered building with the duct protected
as a through penetration also needs none (607.5.3 exception 1). The course's supply ends in flex at
every diffuser; the 2021 IMC added language on nonmetallic flex under that exception (per NC OSFM).

**Recommendation.** Keep the two dampers for the lesson (the sheet says the wall is rated and tags
two FDs, and the estimator bids what is drawn) and add one line that an exception can remove them.
Confidence: **medium**.

**What you still decide.** Whether the card should name the exception or leave it to the rule page.

### R15. M-601 cites IECC C403.11 for the wrap

**The claim.** M-601 section note 3: 2" wrap on all supply duct in the plenum "(IECC C403.11)".

**What the public text says.** Not opened. From memory, duct insulation is C403.11.1 in the 2018
IECC and C403.12.1 in the 2021, and supply duct inside the building envelope may be exempt.

**Recommendation.** Change to "IECC C403 (duct insulation)" or name the edition. Confidence:
**low**.

**What you still decide.** The edition the sample follows.

### R16. The dish room has supply and no exhaust

**The claim.** M-501: DISH 106, 150 CFM supply, no exhaust.

**What the public text says.** Not opened. From memory, IMC 507 wants a Type II hood over a
dishwasher unless its heat and moisture are designed into the HVAC or a separate removal system.

**Recommendation.** Needs the trade's judgment; likely fine on a sample. Confidence: **low**.

**What you still decide.** Whether a restaurant sample should show a Type II hood or a dish exhaust.

## RULEBOOK-SIGN: the four HVAC drafts

### S1. `hvac.exhaust.hood-makeup-air` (content/rules/hvac/hood-makeup-air.md)

**The claim.** Make-up air is required with a commercial hood and interlocked with its exhaust fan;
source IMC 508.1, 2021. The drafter's doubt: which subsection holds the interlock, and whether a
temperature limit applies.

**What the public text says.** The interlock is in 508.1 itself: Minnesota Rule 1346.0508 quotes
508.1 as "electrically interlocked", Illinois' 2024 adoption reads "automatically controlled to start
and operate simultaneously". The temperature limit is 508.1.1: not more than 10°F from the space
(Illinois 2024, as summarized; exceptions exist), and Minnesota amends it to not less than 50°F at the
diffuser. 508.1 also balances make-up from all sources against all exhaust for the building.
2024 adds 508.1.2 (make-up ducts) and 508.1.3 (air balance on the plans), per the Illinois page.

**Recommendation.** Sign with the Verify paragraph answered: interlock 508.1, temperature 508.1.1
(10°F in the model code, amended in some states), and one sentence that the balance is building-wide.
Kind `code` is right. Confidence: **medium-high** (model 2021 text not opened; two adoptions agree).

**What you still decide.** Whether the tempering sentence ("often tempered so the cooks are not in a
winter draft") should cite 508.1.1 as the reason.

### S2. `hvac.diffuser.neck-velocity` (content/rules/hvac/diffuser-neck-velocity.md)

**The claim.** The trade keeps neck velocity between about 400 and 600 fpm; kind `convention`.

**What the public text says.** See T1: the published maker's figure is below 1,000 fpm, with
selection from catalogued NC data. No source for 400 to 600 found.

**Recommendation.** Do not sign as is. Either rewrite it to "select from the maker's sound data; a
common ceiling is about 1,000 fpm; the app's table keeps necks near 430 to 650", or retire it and let
the neck table stand on its own. Confidence: **medium**.

**What you still decide.** The band, if any, your shop uses.

### S3. `hvac.damper.fire-damper` (content/rules/hvac/fire-damper.md)

**The claim.** A listed fire damper where a duct passes a fire-resistance-rated wall; source IMC
607.5.1, 2021. The drafter's doubt: the subsection for the wall in hand.

**What the public text says.** R13 and R14: 607.5.1 is fire walls; a one-hour kitchen wall is
607.5.2 or 607.5.3, each with exceptions. IBC 717.5 holds the same list (ICC CodeNotes article,
opened).

**Recommendation.** Change the section to "607.5 (607.5.1 fire walls, 607.5.2 fire barriers,
607.5.3 fire partitions)", keep `required` as the value, and let the body name the sprinklered
ducted-system and small-duct exceptions. Then sign. Confidence: **high** on the numbering.

**What you still decide.** Whether the value row should read "required unless an exception applies".

### S4. `hvac.ventilation.outdoor-air` (content/rules/hvac/outdoor-air.md)

**The claim.** Occupied spaces get a code minimum of outdoor air by the room's use, per person plus
per area; IMC 403, rates in Table 403.3.1.1. The drafter's doubt: ASHRAE 62.1 versus the IMC table.

**What the public text says.** The table's rates are 62.1's (dining 7.5 and 0.18 in both). Seattle
2021 403.2 exception 2 permits systems "designed in accordance with ASHRAE Standard 62.1 Section 6.2"
(the section carries Washington's tags; I could not confirm it is in the base IMC); exception 1 allows
an engineered design to reduce the rate.

**Recommendation.** Sign, with the Verify paragraph saying the table is 62.1's Ventilation Rate
Procedure and some adoptions allow 62.1 directly. One caution for chapter 9 (outside this row but it
cites this rule): ticking OA on a note that says supply "includes ventilation" is weak when the
equipment schedule prints no OA CFM (R1). Confidence: **medium**.

**What you still decide.** Whether the OA tick in chapter 9 needs the OA number on the schedule first.

## For the tester

**Confirm only** (the research found one answer; say yes or no):

1. P1: the 22"Ø / 26×16 reading is the stray-counts-downstream rule plus the course's trace-before-
   attach order (2,650 − the hall's 100 = 2,550 at every corner). An agent fixes it.
2. T2: exhaust and make-up air never count on a supply unit's capacity; MAU-1, EF-1 and EF-2 are
   their own systems.
3. R1: the air balance keynote must balance outdoor air, not supply (4,650 in against 2,625 out as
   printed).
4. R3: dining at 7.5 per person plus 0.18 per sq ft. Sign.
5. R5: note 4's transfer air is IMC 403.2.2.
6. R13 and S3: 607.5.1 is fire walls; cite 607.5 (607.5.2 or 607.5.3) on the card, the keynote and
   the rule.
7. R10: the plenum arithmetic. Sign.
8. S1: interlock in 508.1, temperature in 508.1.1. Sign with the Verify paragraph answered.
9. S4: sign with the 62.1 note.

**Needs your judgment:**

1. P2 and R8: is the printed main (0.13 to 0.17"/100 ft, about 1,100 fpm) what an engineer prints,
   or does the sheet change?
2. T1 and S2: what number, if any, the neck card and rule quote; why SD-3 is 10".
3. R6: flex to match the neck, or the necks are wrong.
4. R11: wrap or clearance on the grease duct (and the Schedule's 47 sq ft).
5. T3: where the reducers sit relative to the taps.
6. R4: the mop room's exhaust rate.
7. R2: the "larger wins" wording.
8. R7: MA-1 as a single four-way-drawn register.
9. R14: whether the dampers card names the sprinkler exception.
10. T5: a drop symbol for MAU-1.
11. R9, R12, R15, R16: small; the terminal allowance, 12 or 20 ft cleanouts, the IECC edition, a
    dish exhaust.

## Not trade: for an agent

- **A1.** Chapter 5 `attach` (the seam and, by the same rule, the right-click): "Attach to nearest
  run" moves the south-east dining SD-1 from (520,350) to (572,350) on the kitchen branch (52 px
  away against 68 to the main it hangs from on the plan) and the dish SD-1 onto the kitchen branch
  too. DINING reads "needs 1,200 · served 1,050 ⚠" from chapter 5 through 9, against chapter 3's
  "rows that read ✓".
- **A2.** Chapter 8 `lay` ("Finish the takeoff for me"): RTU-1 reads 0 designed / 3,000 ✓ and Static
  path walks the restroom exhaust (38 eq ft), with all seven runs on RTU-1.
- **A3.** A new run takes the active group whatever its airside, so exhaust and make-up runs land on
  RTU-1 (4,575 / 3,000 ⚠ after chapter 7). A product call on how a system is assigned (T2 settles the
  trade side).
- **A4.** The ductulator (duct-model.js `ductDraftRemainingCfm`) counts every stray device as
  downstream of the trace, and counts a device on an already-committed branch as served even when
  that branch taps the main downstream of the draft (a scratch model with the branches traced first
  read 1,200 at the 20x12 change where 1,500 flows). The course traces before it attaches. Either
  reorder the chapter or have the suggestion follow the tap topology.
- **A5.** Wording from HC-TRADE: `sheet:what` swaps the counts (the legend has four kinds of duct,
  three of grille); `diffusers:rest` and chapter 3's done text promise a ✓ the row never draws;
  `exhaust:makeup` opens with "Spiral round in ten-foot sticks…"; `main:trace` says "the corner" at a
  straight point (after T3 is settled).
- **A6.** While probing I pushed three branch runs straight into the annotations and clicking Duct
  left one of them; that was a non-standard path (no undo snapshot, no dirty), so it may be nothing,
  but whoever touches A4 should check that arming the tool never drops a committed run.

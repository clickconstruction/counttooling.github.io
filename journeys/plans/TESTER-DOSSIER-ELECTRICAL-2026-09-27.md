# Tester dossier: the electrical course, researched for the person with the trade

> Written 2026-09-26 by an agent, for the three tester rows **EC-REVIEW**, **EC-TRADE** and the
> electrical half of **RULEBOOK-SIGN** in [PUNCHLIST.md](../../PUNCHLIST.md). This is the research
> half only. The house rule ([PERSONA-PLAN.md](PERSONA-PLAN.md#who-does-what-the-owner-gives-as-little-input-as-possible))
> is that code and trade truth is settled by a person with the trade, never by an agent's edit, so
> nothing here changed a card, a rule, a sheet or the code, and no row is closed. The person reads
> each entry, confirms or rejects the recommendation, and the edit follows their word.

## How to read an entry

Every entry has the same five parts, in this order:

1. **The claim**: the card's, sheet's or rule's words, with the file and the step id or rule id.
2. **What the app computes**, where a number is involved, read from the models or the running app.
3. **What the public code text says**, from a source that could actually be opened, named, and
   paraphrased. Where nothing could be opened, the entry says *from memory*.
4. **Recommendation** (keep, change to X, sign as is, needs the trade's judgment) with a
   **confidence** (high, medium, low) and one line on why.
5. **What the tester still has to decide.**

Card line numbers are features/course-electrical.js as of origin/main d5f81a9 (they have moved
since ELECTRICAL-COURSE.md was written: `sheet:schedule` is now 307, not ~306).

## Sources

**Opened, and used:**

- IAEI Magazine, "Working Space Requirements for Electrical Panelboards" (July/August 2020, on the
  2020 NEC): Table 110.26(A)(1) at 0 to 150 V.
- IAEI Magazine, "Don't Get Caught in the Dark" (NEC 700.12 and 700.17): the unit-equipment branch
  circuit in 2017 (700.12(F)(2)(3)) and 2020 (700.12(I)(2)(3)).
- electricallicenserenewal.com NEC excerpts: 2020 210.8(B) (the twelve items, numbered), 2023
  210.8(B) (the fifteen), 2020 700.12(I)(2), 2023 700.12(H).
- UpCodes: Illinois Building Code 2021 (the IBC 2021) 1008.3 and its subsections; NEC 2023 220.88;
  NEC 2023 700.12(C) (an UpCodes AI summary, which the page itself says may be wrong: treat as
  secondary); Colorado IECC 2024 C405.2.1.
- JADE Learning on 2023 210.8(B); Leviton "Captain Code" and ExpertCE on 2020 422.5(A)(7)
  (dishwashers); EC&M on 440.14; IAEI on the Article 310 renumbering; Mike Holt's forum and NFPA
  Xchange for NFPA 96 10.4.1's wording; ExpertCE and search results for 250.66(A), 250.122, 358.26,
  358.30(A).
- The app: bid-check-model.js, conductor-model.js and circuit-model.js under node, and the running
  app driven through the course's own seam (`App.tutorialDoStep`) for the Bid Check rows.

**Could not open:** the NEC and NFPA 96 themselves (NFPA's free access needs a login);
codes.iccsafe.org returned 403 for the IBC 2018 and 2021 and the IECC 2018 and 2021 chapter pages, so
the IBC 2018 and IECC 2018 and 2021 readings below rest on search-result text and state adoptions,
and say so. Nothing here is the printed code. Where a number matters to a bid, the tester reads it in
their adopted edition.

---

## EC-REVIEW: chapters 2 to 7 and LP-1's schedule, read as an estimator would

The seven findings the 2026-09-24 read already raised are under EC-TRADE below. These are new,
from reading chapters 2 to 7 (features/course-electrical.js 323 to 561) and the four sheets
(scripts/sample-electrical.js) the way an electrical estimator offered the course would.

### R1. "3 #12 + 1 #12 G" on every branch circuit

1. **Claim.** E-101 keynote (scripts/sample-electrical.js 114): all branch circuits 3 #12 CU THHN
   + 1 #12 G in 3/4" EMT unless noted. The course builds both of its 3/4" types from it
   (`makeEmt`, `makeHomerun`; cards `conduit:linetype` 411, `conduit:why12` 417 "three #12 plus a
   ground in every foot", `circuits:homerun` 463). E-201's own keynote says lighting circuits are
   2 #12 + 1 #12 G.
2. **App.** The wire rows are derived from the conductors, so the takeoff carries three #12 plus a
   ground on the 60.5 ft west-wall chain and the 84.17 ft homerun: four conductors a foot where one
   120 V circuit needs three (hot, neutral, ground). Fill is 10.0% as written, 7.5% with 2 #12 + G;
   both pass.
3. **Code.** Nothing requires a third #12. Three #12 on one conduit is either two circuits sharing a
   neutral (a multiwire branch circuit, whose breakers must open together, NEC 210.4(B), *from
   memory*) or one circuit with a spare. Circuits 1 and 3 sit on phases A and B and the homerun runs
   along the north wall past circuit 3's receptacles, so "1 and 3 sharing a neutral in the homerun"
   is a real design; but then the arrow says LP-1-1,3, a handle tie goes on the breakers, and the
   west-wall chain (circuit 1 only) is still 2 #12 + G.
4. **Recommendation.** Needs the trade's judgment. Lean: make the power keynote 2 #12 + 1 #12 G
   per circuit (matching E-201), or name the multiwire pairs on the sheet. Medium: the wire is 33%
   over on every branch run as drawn, which is exactly the number the course says the app counts
   "so it can never be missed".
5. **Tester decides.** Which it is: 2 #12 + G per circuit, or a multiwire homerun (and then the
   tie and the arrow text). Either way the chain on the west wall is 2 #12 + G.

### R2. The dishwasher needs GFCI protection under 2020 and 2023

1. **Claim.** E-501 row 2,4: DISHWASHER, 208V 1Φ, 4800 VA, 2 poles, 30 A, #10. The course teaches
   the row (`sheet:row` 314) and the J-box (`devices:jbox` 353) and never mentions GFCI.
2. **App.** Nothing; the breaker is not a counted device in the course.
3. **Code.** The 2020 NEC added dishwashers to 422.5(A) (item 7) and dropped the dwelling-only
   limit, so a commercial dishwasher rated 150 V or less to ground and 60 A or less, single or three
   phase, gets Class A GFCI protection (Leviton Captain Code 2020, ExpertCE; the 2023 text keeps it,
   same sources). The 2017 edition did not require it outside dwellings (*from memory*).
4. **Recommendation.** Needs the trade's judgment on the edition. If the course's edition is 2020 or
   later: add "GFCI" to the dishwasher's row on E-501 and one line to `sheet:row`'s reveal (a
   two-pole 30 A GFCI breaker is a real price, several times a plain one). Medium-high: the
   requirement is clear in the secondary sources; whether to teach it is the tester's call.
5. **Tester decides.** Which edition the course claims (its rules list 2017, 2020 and 2023), and
   whether the dishwasher's breaker becomes a GFCI on the schedule and a line on the card.

### R3. Circuit 21, the exit and emergency lights on a circuit of their own

1. **Claim.** E-201 keynote (159) and E-501 row 21: exit signs and emergency lights on circuit 21,
   battery backed, 90 min. Card `lighting:os` (391): "on circuit 21 with a battery in each ... and a
   circuit that must not be switched". Rule elec.emergency.battery-duration: "fed from the same
   circuit as the normal lighting in the area, ahead of any switch".
2. **App.** Nothing; counts only.
3. **Code.** 2017 700.12(F)(2)(3): the unit equipment is fed from the same branch circuit as the
   normal lighting in the area, ahead of local switches; a separate circuit was allowed only by an
   exception (an area fed by at least three normal lighting circuits, the separate circuit from the
   same panel, with a lock-on feature). 2020 700.12(I)(2)(3) made the separate circuit a positive
   option: from the same panelboard as the normal lighting, with a lock-on feature (IAEI; the 2020
   excerpt). 2023 700.12(H) keeps both options (the 2023 excerpt).
4. **Recommendation.** Change: the sheet keynote and the card should say circuit 21 has a lock-on
   (a breaker handle lock), which is what makes a separate emergency circuit legal from 2020 on, and
   what the estimator prices. The rule's body should name both options. Medium-high.
5. **Tester decides.** Whether the design stays a separate circuit with a lock-on (the lean), or
   the units move onto 13, 15 and 17 ahead of the switches (then E-501 loses row 21).

### R4. "The dining room gets a dimmer instead"

1. **Claim.** Card `lighting:why` (397): IECC C405.2.1 wants restrooms, storage and break rooms on
   sensors; "The dining room is occupied whenever the restaurant is, so it gets a dimmer at the
   entry instead." E-201 keynote: dining pendants on a dimmer. Rule elec.lighting.occupancy-sensors
   says the same.
2. **App.** Nothing; the Lighting controls row in Bid Check is a manual tick.
3. **Code.** IECC 2021 C405.2.2: every area not on occupant sensors gets time-switch control that
   turns the lights off on a schedule (search-result text of the ICC page; the ICC page itself
   returned 403). A dimmer is not an automatic shutoff. The same edition's C405.2.1 list adds
   corridors, and keeps "other spaces of 300 sq ft or less enclosed by floor-to-ceiling partitions"
   (confirmed in the Colorado IECC 2024 adoption on UpCodes; corridors new in 2021 per MH Companies
   and search text).
4. **Recommendation.** Change the card and the rule: the dining room gets a time switch (or a
   lighting control panel on a schedule), the dimmer is the engineer's choice on top of it. Medium:
   the section is clear, the text was read second hand. Two more rooms may want a sensor under
   2021: the mop room (small and enclosed) and the hall (a corridor), both on circuit 17.
5. **Tester decides.** Whether the set grows two sensors (and the card's "three" and the reference's
   Occupancy 3), or the course names 2018 as its energy code, where only the mop room is in question.

### R5. The bar cited as a kitchen

1. **Claim.** Card `devices:missed` (335): "the bar and the kitchen (a sink and food preparation,
   NEC 210.8(B)(2))".
2. **App.** Nothing.
3. **Code.** 2017 210.8(B)(2) is "Kitchens", and the 2017 definition of a kitchen needs a sink and
   provisions for food preparation *and* cooking (search text quoting the 2017 Article 100
   definition), so a bar without cooking is caught only by (B)(5), within 6 ft of the sink. 2020
   (B)(2) reads kitchens or areas with a sink and food preparation *or* cooking (the 2020 excerpt).
   2023 splits it: (B)(2) kitchens, (B)(3) areas with a sink and food, beverage preparation or
   cooking, and sinks move to (B)(7) (the 2023 excerpt; JADE Learning).
4. **Recommendation.** Change the card to cite the bar by the sink (210.8(B)(5) in 2017 and 2020),
   which is how E-101 placed them (scripts/sample-electrical.js 30: within 6 ft of the bar hand
   sink), and holds in every edition. Medium.
5. **Tester decides.** Confirm, or keep (B)(2) and state 2020 as the course's edition.

### R6. No service receptacle at the rooftop units

1. **Claim.** E-101 draws RTU-1 and EF-1 as J-boxes "TO ... ON ROOF"; no roof plan, no maintenance
   receptacle. Card `equipment:poles` (507) prices the roof disconnect only.
2. **App.** Nothing.
3. **Code.** 210.63: a 125 V, 15 or 20 A receptacle within 25 ft of heating, air-conditioning and
   refrigeration equipment, on the same level, not on the load side of the unit's disconnect (EC&M,
   Electrician U, UpCodes titles); a rooftop receptacle is GFCI under 210.8(B)(3) (2017, 2020) and
   (B)(5) (2023) (the excerpts).
4. **Recommendation.** Needs the trade's judgment. Lean: add a line to `equipment:poles`'s reveal
   (the roof also gets a GFCI service receptacle within 25 ft, 210.63), since the set has no roof
   plan to count it on. Medium-high on the code, the teaching is a call.
5. **Tester decides.** Whether to teach it on the card, add a roof note to E-101, or leave it.

### R7. Voltage drop "at the load the engineer scheduled"

1. **Claim.** Card `circuits:load` (482): E-501 schedules circuit 1 at 720 VA, 6 A; set Load to 6 and
   the row ticks; "When the schedule gives a load, use it".
2. **App.** Read from the running app (circuit 1 as the chapter's seam builds it, 145 ft to the
   farthest receptacle with the verticals): 12 A → 5.7%, wants #8; 8 A → 3.8%, wants #10;
   **6 A → 2.9% ✓**; 16 A → 7.6%, wants #6. The pass is a hair under the 3% line.
3. **Code.** 720 VA is four receptacles at 180 VA each, the load-calculation figure for service
   sizing (220.14(I), *from memory*), not a measured load. The 3% is a recommendation (an
   Informational Note to 210.19(A)), not a requirement.
4. **Recommendation.** Needs the trade's judgment. The lesson (the default warning is honest, a real
   load answers it) is sound; the risk is teaching that the 180 VA figure is what the circuit
   carries. A sentence such as "720 VA is the calculation's figure; a shop that designs to 80% of the
   breaker would run #10 here" would keep both. Medium.
5. **Tester decides.** Whether a 145 ft 20 A receptacle circuit on #12 is what their shop would
   bid, and what load the card should tell a new estimator to use.

### R8. "23 A, so the circuit goes to a 30 A breaker"

1. **Claim.** Card `sheet:row` reveal (314) and rule elec.conductor.small-protection body: 4800 VA
   at 208 V is 23 A, #12 is capped at 20 A, "so the circuit goes to a 30 A breaker".
2. **App.** 4800 / 208 = 23.1 A (the card's figure is right).
3. **Code.** 25 A is a standard breaker size (240.6(A), *from memory*). A 30 A breaker comes from the
   nameplate's maximum overcurrent device, or from 125% of a continuous load (23.1 × 1.25 = 28.8 A).
4. **Recommendation.** Change one clause: "so the circuit goes to the next breaker the nameplate
   allows, 30 A, and a 30 A breaker wants #10". Low-medium: the answer is right, the reasoning skips
   a size.
5. **Tester decides.** Confirm the wording.

### R9. E-601's service lateral carries a ground, in THHN

1. **Claim.** E-601 (251): SERVICE LATERAL: 2" C, 4 #3/0 CU THHN + 1 #6 CU G, 60 FT (UTILITY).
2. **App.** Not traced in the course.
3. **Code.** Service conductors have no equipment grounding conductor; the grounded (neutral)
   conductor is brought to the service disconnect and carries fault current back (250.24(C); EC&M
   and search text). An underground raceway is a wet location, so plain THHN is not enough; the wire
   must be wet-rated (THWN or THHN/THWN-2) (300.5(B), 310.10(C), *from memory*). A utility-owned
   lateral is outside the NEC altogether (90.2(B)(5), *from memory*) and is usually aluminum.
4. **Recommendation.** Change the E-601 label to drop "+ 1 #6 CU G" and write the wire as
   THHN/THWN-2 (the feeder too, where it passes the outside wall). Medium: the ground is a clear
   error; the rest is drafting.
5. **Tester decides.** Whether the lateral is the utility's (then E-601 need not size it at all) or
   the contractor's conduit with the utility's wire, which is common and changes what the bid carries.

### R10. "#12 CU THHN is rated 20 A"

1. **Claim.** E-501 schedule note 6 (237): #12 CU THHN IS RATED 20 A (NEC 240.4(D), 310.16).
2. **App.** Nothing.
3. **Code.** #12 copper's table ampacity is 25 A at 75 °C and 30 A at 90 °C; 240.4(D) caps the
   breaker at 20 A (*from memory* for the table; the cap from the 240.4(D) secondary sources). The
   card (`conduit:why12`) says it right: "may be protected at no more than 20 A".
4. **Recommendation.** Change the note to "#12 CU IS PROTECTED AT 20 A MAX (NEC 240.4(D))". Medium:
   a new estimator who learns "rated 20 A" misreads derating later.
5. **Tester decides.** Confirm.

### R11. The meter is the utility's

1. **Claim.** Card `service:gear` (553): make a Meter counter and click the meter; "gear the bid
   carries". E-601 labels it METER, UTILITY.
2. **App.** A counter named Meter.
3. **Code.** Not a code question: the utility furnishes the meter; the contractor sets the meter
   base (socket), sometimes utility-furnished too (*trade practice, from memory*).
4. **Recommendation.** Change one word: "Make a Meter counter and click the meter base". Low-medium.
5. **Tester decides.** Their utility's practice.

### R12. The engineer's missed receptacle is on no circuit

1. **Claim.** POWER.missed (scripts/sample-electrical.js 38) is drawn but belongs to no row of E-501;
   circuit 11, KITCHEN GFCI, is 360 VA, two receptacles.
2. **App.** The reference counts it (11 duplex).
3. **Code.** None; a drafting gap in the teaching set.
4. **Recommendation.** Keep the sheet as is and let the RFI ask the circuit too ("GFCI, and on which
   circuit?"), which is the question a real estimator would ask. Low.
5. **Tester decides.** Whether the RFI note's text should carry the circuit question.

### R13. The panel schedule's loads and sizes: what checks out

1. **Claim.** E-501 (184 to 203): nineteen rows, CONNECTED LOAD 22.3 kVA · 62 A AT 208V 3Φ, main
   200 A "for the kitchen's future load (NEC 220)"; card `service:read` (533).
2. **App / arithmetic.** The VA column sums to 22,351 VA; 22,351 / (208 × 1.732) = 62.0 A. Every
   receptacle row is 180 VA a receptacle. Lighting rows are the lamp watts times the counts on E-201
   (13 × 18, 10 × 40, 8 × 12, 2 × 3 + 3 × 5). Poles land on the right phases (2,4 and 8,10 on phases A
   and B; 18, 20, 22 on C, A and B).
3. **Code.** Under 220.88, the optional method for a new restaurant, a restaurant that is not all
   electric with 200 kVA or less connected is taken at 100% of its connected load (UpCodes NEC 2023
   220.88; the percentage from search text, the table not opened). So "22 kVA connected, 62 A" is a
   defensible calculation, and the card's sentence holds.
4. **Recommendation.** Sign as is, with R14 below. Medium-high.
5. **Tester decides.** Only whether a restaurant with no walk-in, no reach-ins, no cook-line
   equipment beyond two receptacles and no hand dryers reads as believable enough to teach on. It is
   a teaching set; the lean is to leave it.

### R14. RTU-1: 9000 VA, 40 A, #8, 1"

1. **Claim.** E-501 row 18,20,22; card `equipment:poles`: a 40 A breaker and #8 wire.
2. **App.** 9000 VA at 208 V three phase is 25 A. 3 #8 + 1 #10 G is 24.6% of 3/4" EMT and 15.2% of 1"
   (both pass; the schedule's 1" is generous).
3. **Code.** Air-conditioning circuits are sized from the nameplate's minimum circuit ampacity and
   maximum overcurrent device under Article 440, not 240.4(D) (240.4(G); the 240.4(D) sources). #8
   at 40 A is conservative and legal; #10 would likely do on a 25 A unit.
4. **Recommendation.** Sign as is. Medium: the numbers are plausible, a nameplate would settle them.
5. **Tester decides.** Nothing unless they want the row to read like a real nameplate.

### Confirmed, nothing to change (chapters 2 to 7)

Read against the code and found right: the heights card (`devices:heights`: 6 ft 7 in for a switch
or breaker handle, ADA 15 to 48 in, 44 in over a counter); conduit fill on the branch runs (10.0%)
and the feeder (33.4% in 2", and 1-1/2" would fail at 55.1%, as `service:fill` says); EMT straps
(`conduit:straps`, 358.30(A)); why three phase (`equipment:poles` reveal); the shunt-trip RFI
(`equipment:hood`); #3/0 at 200 A, the #6 ground, the #4 electrode conductor (`service:read`).

---

## EC-TRADE: the seven findings of the 2026-09-24 read

Source: [ELECTRICAL-COURSE.md "Trade findings from the 2026-09-24 read"](ELECTRICAL-COURSE.md#trade-findings-from-the-2026-09-24-read).

### T1. Two 208 V two-pole circuits on E-501

1. **Claim.** `sheet:schedule` (307): "Find the one circuit on LP-1 that is 208 V and two-pole." Its
   check accepts only a highlight crossing y 549, the dishwasher's row; the hint for a wrong row says
   "read down the P column for a 2, and the description for 208V", which EF-1 (8,10) also satisfies.
   `sheet:row` (314): "every other circuit is #12". `equipment:poles` (507): "Everything else is one
   pole at 120 V."
2. **App.** E-501 rows 2,4 DISHWASHER 208V 1Φ, 2 poles, 30 A, #10; 8,10 EF-1 HOOD EXHAUST FAN 208V
   1Φ, 2 poles, 20 A, #12; 18,20,22 RTU-1, 3 poles, 40 A, #8.
3. **Code.** Nothing wrong on the sheet: a 208 V single-phase load across two poles of a 208Y/120 V
   panel is normal, and a hood fan on it is believable.
4. **Recommendation.** Change the three cards, not the sheet: `sheet:schedule` asks for "the one
   two-pole circuit on a 30 A breaker" or simply "the dishwasher's row"; `sheet:row` says "every 20 A
   circuit is #12" (RTU-1 is #8 on 40 A); `equipment:poles` says "EF-1 takes two poles too, 208 V
   single phase; everything else is one pole at 120 V". High: the sheet has two answers and the
   cards say one.
5. **Tester decides.** Only whether EF-1 should stay single phase (it may as well be 3Φ on a
   three-phase building; the lean is keep, it teaches that two poles is not three phase).

### T2. The receptacle story in chapter 2

1. **Claim.** `devices:gfci` (328): "The plan shows twenty receptacles" (there are 21: 11 drawn as
   duplex, 10 as GFCI; the chapter's done text says 21). Its check accepts the missed kitchen duplex
   as a GFCI click without asking for it. `devices:duplex` (342) then counts it again as a duplex,
   and its body says both "the bid carries it as a GFCI" and "count what is drawn".
2. **App.** A reader who clicks it in both steps has 22 marks for 21 receptacles. The reference
   (`COUNTS`) expects 11 duplex and 10 GFCI.
3. **Code.** 210.8(B)(2) in every edition: every 125 V 15/20 A receptacle in a commercial kitchen is
   GFCI (the 2020 and 2023 excerpts; 2017 from the same item number).
4. **Recommendation.** Needs the trade's judgment on which way; either is defensible, both at once
   is not. Lean: count it once, as a GFCI, because the inspector will fail a plain duplex in a
   kitchen and the bid carries what will pass; the RFI asks the question (and the circuit, R12). Then
   `gfci` expects eleven, `duplex` ten, and the reference moves to 10 and 11. Medium.
5. **Tester decides.** GFCI (count to the code) or duplex (count to the drawing, carry an add in the
   RFI). Say which, and the three steps and the reference follow in one edit.

### T3. E-601 calls the dishwasher three phase

1. **Claim.** E-601 note 2 (scripts/sample-electrical.js 270): THREE PHASE FOR RTU-1 AND THE
   DISHWASHER. E-501 says DISHWASHER, 208V 1Φ on two poles, and the course agrees.
2. **App.** Nothing reads E-601's notes.
3. **Code.** A two-pole breaker cannot feed a three-phase load; the sheets contradict each other.
4. **Recommendation.** Change E-601 note 2 to THREE PHASE FOR RTU-1; 120 V FROM ANY PHASE TO
   NEUTRAL. High.
5. **Tester decides.** Confirm (the alternative, a three-phase dishwasher, would change E-501, the
   highlight target and three cards).

### T4. The rise

1. **Claim.** `service:rise` (544): the MDP at 5 ft outside, the panel top at 6 ft 6 in inside,
   "the one-line calls the whole feeder 12 ft"; drop 5 ft at the MDP end. The reference feeder is
   plan 7.33 ft + 5 = 12.33 ft (`RUNS`, read from the running app).
2. **App.** The plan draws the feeder from the south wall along the west wall to LP-1's side; it says
   nothing about height. E-601 (253): FEEDER ... 12 FT.
3. **Code.** None; this is routing. The only heights on the sheets are the MDP at 60 in (the
   course's mount) and LP-1's top at 78 in (E-101 keynote); a 42-circuit panel's bottom is roughly 2
   ft above the floor (*trade practice, from memory*).
4. **Recommendation.** Needs the trade's judgment. The 5 ft has no drawing behind it. Three honest
   versions: (a) through the wall at the MDP and up into LP-1's top: 78 − 60 in = 1.5 ft, feeder
   about 8.8 ft, E-601 says 9 FT; (b) up to the 10 ft ceiling and down into the top: 5 + 3.5 =
   8.5 ft of vertical, feeder about 15.8 ft; (c) keep 5 ft and add the route that makes it to E-101
   as a keynote. Medium on the diagnosis, the choice is the trade's.
5. **Tester decides.** The route, and so the rise, E-601's length and the reference; an agent then
   edits the card, the sheet and `RUNS` together.

### T5. The clearance: wall or panel face

1. **Claim.** `sheet:clearance` (301): "Click the two circled ends of the box, wall to its outer
   edge." The dashed box (scripts/sample-electrical.js 42) starts at the panel's face, and the
   circles sit on the box, so the check passes at 3 ft; a reader who clicks the wall reads about
   3'-10".
2. **App.** The course's own measure reads Distance 3'-0" (the spec pins it).
3. **Code.** 110.26(A)(1): the depth is measured from the exposed live parts, or from the enclosure
   front when they are enclosed (search text of the 110.26(A)(1) excerpt; the 2026 edition reworded
   the sentence, same meaning). The drawing is right.
4. **Recommendation.** Change the card: "Click the two circled ends of the box, the panel's face to
   its outer edge." High.
5. **Tester decides.** Confirm.

### T6. Arrows that are not where the text says

1. **Claim.** `circuits:homerun` (463): "The arrow at the top receptacle says LP-1-1" (it sits
   between the second and third). `sheet:panel` (295): "Every homerun arrow on the plan points at one
   thing" (they are sideways stubs; LP-1-9 at the north wall points west, away from LP-1).
2. **App.** POWER.homeruns (scripts/sample-electrical.js 44); the arrow direction is set by x < 700.
3. **Code.** None. A homerun arrow is a drafting convention: it says the run goes to the panel, it
   does not have to aim at it (*trade practice*).
4. **Recommendation.** Not trade truth; an agent rewords (`sheet:panel`: "Every homerun arrow names
   one panel: find it"; `circuits:homerun`: "The arrow beside the west wall says LP-1-1"). Listed
   again under "Not trade". High that it needs no tester.
5. **Tester decides.** Nothing.

### T7. Prove it opens with "the same string"

1. **Claim.** ELECTRICAL-COURSE.md lists `sheet:prove` (289) opening with "the same string" as the
   plumbing course. The current card text does not say it (it reads "The engineer wrote 31'-8" over
   the kitchen half of the building").
2. **App / code.** Neither.
3. **Recommendation.** Appears fixed already; an agent confirms and strikes it from the plan. High.
4. **Tester decides.** Nothing.

---

## RULEBOOK-SIGN: the fifteen electrical drafts

All fifteen are `status: draft`, `used_by: []`, updated 2026-09-26, in content/rules/electrical/.
None has a `code:` pointer, so none is checked by `build:rules --check` against a number in the app;
signing one is a judgment on its words.

### S1. elec.panel.working-space (working-space.md)

1. **Claim.** 36 in deep "(0 to 150 V to ground, Condition 1)", 30 in wide, 6.5 ft high; 110.26(A),
   2017 to 2023.
2. **App.** Nothing applies it; the course's measure reads 3'-0".
3. **Code.** Table 110.26(A)(1): at 0 to 150 V to ground, all three conditions are 3 ft (IAEI 2020).
   The depth is measured from the enclosure front (T5). Width 30 in or the equipment's width,
   height 6.5 ft or the equipment's height (110.26(A)(2), (A)(3), *from memory*, consistent with the
   ExpertCE and EC&M summaries).
4. **Recommendation.** Sign with one change: the depth row's condition reads "0 to 150 V to ground,
   any condition" and the body adds "measured from the front of the enclosure". **The drafter's
   doubt (Condition 1) is answered: at 120/208 V the condition does not change the 36 in.** High.
5. **Tester decides.** Sign.

### S2. elec.conductor.small-protection (small-conductor-protection.md)

1. **Claim.** #14 at 15 A, #12 at 20 A, #10 at 30 A, copper; 240.4(D), 2017 to 2023.
2. **App.** Nothing compares breaker and wire.
3. **Code.** 240.4(D)(3), (5) and (7) give exactly those three (the 240.4(D) secondary sources);
   240.4(G) sends motor and air-conditioning circuits to their own articles, as the rule's verify
   paragraph says.
4. **Recommendation.** Sign as is; optionally soften "a load of 23 A goes to a 30 A breaker" per R8.
   High.
5. **Tester decides.** Sign, and whether R8's clause goes in.

### S3. elec.conductor.ampacity (conductor-ampacity.md)

1. **Claim.** #3/0 copper THHN, 75 °C column, 200 A; 310.16, editions 2020 and 2023.
2. **App.** Nothing checks the size; the feeder's wire is derived.
3. **Code.** The table was Table 310.15(B)(16) from 2011 through 2017 and is Table 310.16 again from
   2020 (IAEI, "The Reorganization of NEC Article 310"). The 200 A at 75 °C for #3/0 copper is the
   standard figure (*the table itself not opened*). The 75 °C column for terminals over 100 A is
   110.14(C)(1)(b) (*from memory*). One check worth a line: the neutral of a 3Φ 4W wye counts as a
   current-carrying conductor when most of the load is nonlinear, which would derate four #3/0
   (310.15(E)(3), *from memory*); the restaurant's load is mostly motors and heat, so it does not
   apply here.
4. **Recommendation.** Sign, adding 2017 to `editions` with the section written as "310.16
   (Table 310.15(B)(16) in 2017)". **The drafter's doubt is answered: 2017's name is
   Table 310.15(B)(16).** High.
5. **Tester decides.** Sign.

### S4. elec.gfci.non-dwelling (gfci-locations.md)

1. **Claim.** Restrooms 210.8(B)(1); kitchens "or any area with a sink and food preparation or
   cooking" (B)(2); within 6 ft of a sink (B)(5); editions 2017 to 2023.
2. **App.** Nothing decides which receptacles need GFCI.
3. **Code.** 2017 and 2020: (1) bathrooms, (2) kitchens, (5) sinks within 6 ft of the bowl's top
   inside edge. 2023: (1) bathrooms, (2) kitchens, (3) areas with a sink and food, beverage
   preparation or cooking, (7) sinks (the 2020 and 2023 excerpts; JADE; search text for 2017). The
   "or cooking" wording is 2020's; 2017 needed a sink, food preparation *and* cooking to be a kitchen.
   2020 also widened the scope to 250 V receptacles on circuits up to 50 A single phase.
4. **Recommendation.** Sign with changes: the kitchen row reads "kitchens, 210.8(B)(2) (and in 2023,
   areas with a sink and food or beverage preparation, (B)(3))"; the sink row reads "(B)(5), (B)(7)
   in 2023"; the body's "a bar with a sink and food preparation counts" becomes "a bar counts by its
   sink in every edition, and as a food or beverage area from 2020 on" (see R5). **The drafter's doubt
   is answered: the numbers are right for 2017 and 2020; 2023 moves sinks to (7) and adds (3).**
   Medium-high.
5. **Tester decides.** Sign, and whether the dishwasher's 422.5(A)(7) GFCI (R2) gets a rule of its
   own.

### S5. elec.emergency.battery-duration (emergency-battery-duration.md)

1. **Claim.** 90 minutes, 700.12, 2017 to 2023; the body: unit equipment fed from the same circuit
   as the normal lighting, ahead of any switch.
2. **App.** Nothing.
3. **Code.** 2017 700.12(F): unit equipment, batteries for at least 1½ hours (at 87½% of battery
   voltage, or 60% of the initial light) (search text of the 2017 section). 2020 700.12(I): the same
   figures under (I)(1), the installation and branch circuit under (I)(2) (the 2020 excerpt). 2023:
   the duration moved to 700.12(C) Supply Duration, 1½ hours for storage batteries and UPS (UpCodes
   2023, an AI summary: secondary), and unit equipment became 700.12(H) Battery-Equipped Emergency
   Luminaires, which must be listed and states no duration of its own (the 2023 excerpt). Branch
   circuit: R3.
4. **Recommendation.** Sign the 90 minutes, change `section` to name the letters by edition ("700.12(F)
   in 2017, (I) in 2020, (C) and (H) in 2023"), and change the body to allow the separate circuit with
   a lock-on (R3). **The drafter's doubt is answered: F, then I, then C and H.** Medium-high: the 2023
   (C) rests on a secondary summary.
5. **Tester decides.** Sign, after reading 700.12(C) in a 2023 copy if their jurisdiction is on 2023.

### S6. elec.egress.illumination (egress-illumination.md)

1. **Claim.** 90 minutes, IBC 1008.3, 2018 and 2021.
2. **App.** Nothing.
3. **Code.** IBC 2021 (the Illinois adoption on UpCodes): 1008.3.1 rooms and spaces needing two or
   more exits, 1008.3.2 buildings needing two or more exits, 1008.3.3 rooms and spaces (electrical
   rooms, fire pump rooms, large public restrooms and others), **1008.3.4 Duration, 90 minutes**, by
   storage batteries, unit equipment or an on-site generator, 1008.3.5 the illumination level on
   emergency power. IBC 2018: 1008.3.4 Duration and 1008.3.5 levels as well (search-result text, the
   ICC page 403'd). Exit signs have their own 90 minutes in 1013.6.3 (*from memory*).
4. **Recommendation.** Sign with `section: "1008.3.4"`. **The drafter's doubt is answered: the 90
   minutes is 1008.3.4 in both editions.** High for 2021, medium for 2018.
5. **Tester decides.** Sign.

### S7. elec.lighting.occupancy-sensors (occupancy-sensors.md)

1. **Claim.** Restrooms, storage rooms, break rooms and the other listed spaces get occupant sensors;
   "A dining room, occupied whenever the restaurant is, gets a dimmer or a switch instead"; IECC
   C405.2.1, 2018 and 2021.
2. **App.** Nothing; a manual Bid Check row.
3. **Code.** R4: C405.2.1's list includes restrooms, storage rooms, lounges and break rooms in 2018
   and 2021, adds corridors in 2021, and catches enclosed spaces of 300 sq ft or less; C405.2.2 puts
   every other area on time-switch control. Read second hand (ICC 403; the Colorado 2024 adoption
   opened).
4. **Recommendation.** Change the body's dining-room sentence to "gets time-switch control instead
   (C405.2.2); a dimmer is the designer's choice on top of it", and add 2024 to the editions once
   read. Medium.
5. **Tester decides.** Sign after the change, and R4's two rooms.

### S8. elec.emt.support (emt-support.md)

1. **Claim.** Within 3 ft of each box or termination, every 10 ft along the run; 358.30(A).
2. **App.** Nothing; the card makes a Strap row at 1 per 10 ft by hand.
3. **Code.** 358.30(A): fastened at least every 10 ft and within 3 ft of each box, cabinet, conduit
   body or termination; Exception 1 allows 5 ft where framing does not permit 3 ft, Exception 2 lets
   unbroken lengths be fished in finished work (search text quoting the section; ExpertCE).
4. **Recommendation.** Sign as is. High.
5. **Tester decides.** Sign.

### S9. elec.emt.bends (emt-bends.md)

1. **Claim.** No more than 360° of bends between pull points; 358.26.
2. **App.** A manual Bid Check row.
3. **Code.** 358.26, Bends, Number in One Run: the equivalent of four quarter bends, 360° total,
   between pull points such as conduit bodies and boxes (EC&M Q&A; several secondary sources agree).
4. **Recommendation.** Sign as is. High.
5. **Tester decides.** Sign.

### S10. elec.disconnect.within-sight (disconnect-within-sight.md)

1. **Claim.** A disconnect within sight of AC and refrigeration equipment, readily accessible;
   440.14. The body: "where it can be reached without a ladder or a key"; the verify paragraph:
   "exceptions ... for disconnects that can be locked open".
2. **App.** Nothing.
3. **Code.** 440.14: within sight from and readily accessible from the equipment, and it may be on
   or in the unit; "within sight" is visible and not more than 50 ft. Exception No. 1 (a remote
   lockable disconnect) is only for equipment essential to an industrial process with written
   safety procedures and qualified service staff (EC&M; ExpertCE-type summaries). "Readily
   accessible" rules out portable ladders and tools, and from 2020 says tools other than keys, so a
   key does not make a disconnect inaccessible (*from memory*).
4. **Recommendation.** Change two phrases: "without a portable ladder or tools" (drop "or a key"),
   and the exception "for industrial process equipment only, never a restaurant's rooftop unit".
   Medium-high.
5. **Tester decides.** Sign after the change.

### S11. elec.hood.shunt-trip (hood-shunt-trip.md)

1. **Claim.** NFPA 96 10.4.1, 2017, 2021, 2024: on discharge, the power that heats the protected
   equipment shuts off; the receptacles question is the engineer's and the AHJ's reading.
2. **App.** Nothing.
3. **Code.** 10.4.1: on actuation of the cooking fire-extinguishing system, all fuel and electric
   power that produce heat to the protected equipment shut off automatically; 10.4.2 exempts steam
   from an outside source; 10.4.4 wants manual reset (quoted on Mike Holt's forum and NFPA Xchange,
   attributed to the 2017 and 2024 editions; UpCodes lists the same "Fuel and Electric Power
   Shutoff" title in NFPA 96 2021 and 2024). The receptacle reading is exactly the drafter's: it
   turns on "produce heat".
4. **Recommendation.** Sign, section 10.4.1. **The drafter's doubt on the number is answered: 10.4.1
   in 2017 and 2024, the same title in 2021.** Medium-high: the standard itself was not opened.
5. **Tester decides.** Sign, and their reading of plug-in cooking receptacles under the hood (the
   course's circuit 12 puts them on the shunt trip, which is the common and conservative reading).

### S12. elec.circuit.fixed-equipment (fixed-equipment-circuits.md)

1. **Claim.** Equipment fastened in place on a 15 or 20 A circuit that also feeds lights or plug-in
   loads: no more than half the rating; 210.23; the summary adds "which is why the dishwasher, the
   pump and the rooftop unit each get a circuit of their own".
2. **App.** Nothing.
3. **Code.** 2017 and 2020: 210.23(A)(2). 2023: 210.23(A) became 10 A branch circuits, the 15 and 20
   A paragraph moved to (B), and the 50% rule is 210.23(B)(2) (Mike Holt's forum, 2023 thread on
   210.23(B)(1)-(2); search text). The 50% only bites where the circuit also feeds lights or
   plug-in loads; nothing in 210.23 requires a dedicated circuit (the rule's own verify paragraph
   says so).
4. **Recommendation.** Sign with the section written "210.23(A)(2), (B)(2) in 2023", and change the
   summary's "which is why" to "and the simple way to live within it is a circuit each; the size of
   each load, the maker's instructions (110.3(B)) and Article 440 for the rooftop unit do the rest".
   **The drafter's doubt is answered: (A)(2) through 2020, (B)(2) in 2023.** Medium.
5. **Tester decides.** Sign after the change.

### S13. elec.ground.equipment-conductor (equipment-ground-size.md)

1. **Claim.** 200 A overcurrent device, copper: #6; 250.122, Table 250.122.
2. **App.** Counts the ground as its own row.
3. **Code.** Table 250.122: 200 A, #6 copper; 250.122(B): upsize the ground in proportion when the
   phase conductors are upsized (ExpertCE; the 250.122(B) excerpt title; several summaries).
4. **Recommendation.** Sign as is. High.
5. **Tester decides.** Sign.

### S14. elec.ground.electrode-conductor (electrode-conductor-size.md)

1. **Claim.** Copper service conductors #2/0 or #3/0: #4 copper; the rod-only run never over #6
   (250.66(A)).
2. **App.** Nothing.
3. **Code.** Table 250.66: 2/0 or 3/0 copper, #4 copper; 250.66(A): the portion that is the sole
   connection to rod, pipe or plate electrodes need not be larger than #6 copper (ExpertCE and the
   250.66(A) excerpt title). 250.66(B) caps a concrete-encased electrode's conductor at #4
   (*from memory*).
4. **Recommendation.** Sign as is. **The drafter's doubt is answered: the #6 cap is 250.66(A).**
   High.
5. **Tester decides.** Sign.

### S15. elec.service.load-calculation (service-load-calculation.md)

1. **Claim.** A service or feeder rated for at least the Article 220 load; "The course's restaurant
   calculates to about 22 kVA".
2. **App.** Nothing; see R13 for the arithmetic (22,351 VA, 62.0 A).
3. **Code.** 220.88, new restaurants: the connected load with the table's demand factor in place of
   the standard method; a restaurant not all electric at 200 kVA or less is taken at 100% (UpCodes
   2023 section; the percentage from search text). That makes the course's 22 kVA a calculated load,
   not only a connected one. The "at least the calculated load" requirement sits in 230.42(A) and
   230.79 for services and 215.2 for feeders (*from memory*).
4. **Recommendation.** Sign with the body naming 220.88 ("the course's restaurant, not all electric,
   calculates at 100% of its 22 kVA connected load by the optional method of 220.88") and the
   section field reading "Article 220 (220.88 for a new restaurant)". Medium.
5. **Tester decides.** Sign after the change; confirm the 220.88 table row in their edition.

---

## For the tester

**Confirm only** (the research found the claim right, or the fix is mechanical; a yes is enough):

- T1: ask for the dishwasher's row; "every 20 A circuit is #12"; EF-1 is two poles too.
- T3: E-601 note 2 names RTU-1 only.
- T5: measure from the panel face, not the wall.
- R10: E-501 note 6 says "protected at 20 A max", not "rated 20 A".
- R12: the RFI also asks which circuit.
- R13, R14: the panel schedule's loads and sizes add up; leave them.
- S1 (drop "Condition 1"), S2, S3 (add 2017 as Table 310.15(B)(16)), S6 (section 1008.3.4), S8, S9,
  S13, S14: sign.
- S5 and S12: sign with the per-edition letters written in.
- S11: sign 10.4.1.

**Needs the trade's judgment** (the research narrows it; the person chooses):

- T2: the missed kitchen receptacle, counted once as a GFCI (the lean) or once as a duplex.
- T4: the feeder's route, and so the rise (1.5 ft, 8.5 ft, or a keynote for the 5 ft).
- R1: "3 #12 + G" on every branch run, or 2 #12 + G, or a named multiwire homerun.
- R2: the dishwasher's GFCI breaker (2020 and later).
- R3: circuit 21 keeps its own circuit with a lock-on (the lean), or joins the lighting circuits.
- R4 and S7: the dining room's time switch; sensors in the mop room and the hall.
- R5 and S4: cite the bar by its sink; which edition the course speaks.
- R6: teach the rooftop service receptacle or not.
- R7: what load a new estimator should use for voltage drop (the pass at 6 A is 2.9%).
- R8, R9, R11: small wording changes that are trade calls (the 25 A breaker, the service lateral's
  ground and wire type, the meter base).
- S10: "readily accessible" and the industrial-only exception.
- S15: name 220.88.

## Not trade: for an agent

- T6: `sheet:panel` and `circuits:homerun` describe the arrows wrongly; reword (the arrows are
  drafting, not trade).
- T7: `sheet:prove` no longer says "the same string"; strike the line from ELECTRICAL-COURSE.md.
- `devices:gfci` says "twenty receptacles"; it is 21 either way T2 is decided.
- Whatever T2 and T4 decide, the reference moves with them: `COUNTS` and `RUNS` in
  features/course-electrical.js, the compare card's "sixty-nine marks", the spec's pinned counts
  (course-electrical.spec.js), and a sheet change means `npm run build:sample-electrical` with the
  lesson coordinates checked in the same commit.
- The Bid Check fill row prints the feeder as "4 3/0 THHN" beside "1 #6"; cosmetic, the "#" is
  missing on 3/0 only.

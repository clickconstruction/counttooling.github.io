# Tester's dossier: the plumbing course and tour, 2026-09-27

> Research for three punch-list rows, PC-REVIEW, PC-TRADE and PT-TRADE, so the person with the trade
> confirms or rejects instead of starting from nothing. Written by an agent. Nothing here was edited:
> no card, rule, sheet or code changed, and no row is closed (PERSONA-PLAN.md "Who does what": code
> and trade truth is a tester's call). Read on main at d5f81a9.

## How to read an entry

Each entry has, in order: **the claim** (quoted, with the file and step id), **what the app
computes**, **what the public code text says** (the page opened, its edition and section; *from
memory* where nothing could be opened), a **recommendation** with a **confidence** (high, medium,
low) and why, and **what the tester still has to decide**. Line numbers are approximate. "The
course" is features/course-plumbing.js; "the sheets" are scripts/sample-plan-candidates.js (P-101 is
`candidateB`, P-401 `lessonDetailSheet`, P-501 `lessonScheduleSheet`, P-601 `lessonRiserSheet`).
Plan feet are plan px ÷ 12.

### Sources

Opened, and quoted here only by section and a few words:

- **IPC 2018**, as adopted in the *Department of Defense Plumbing Code 2018* on UpCodes
  (up.codes/viewer/department-of-defense/ipc-2018): Table 308.5 and 306.2 (chapter 3), 403.1 and
  410.4 (chapter 4), 604.5 (chapter 6), 704.1, 708.1, Tables 709.1 and 709.2, 709.4, Table 710.1(1)
  (chapter 7), 802.1 and 802.3 (chapter 8), 901.2, 903.1, 903.5, 912 (chapter 9), 1002.2, 1002.4,
  1003.2, 1003.3.1 (chapter 10). The DoD edition carries some DoD amendments; where one showed (a
  10 fps velocity in 604.3) it is not used here.
- **IPC 2021**: Table 909.1 in ICC's own brochure *Methods of Venting Plumbing Fixtures and Traps in
  the 2021 IPC* (posted by Lower Gwynedd Township); Appendix E, Table E103.3(2) and its footnote a,
  from a manufacturer's reprint of the 2021 IPC pages (thermoflowpro.com); 704.1 as adopted in the
  *Tennessee Plumbing Code 2021* on UpCodes; 607.2 as adopted in the *Maryland Plumbing Code 2024*
  on UpCodes.
- **IFGC 2021** Table 415.1, from ICC's sample pages of the 2021 IFGC (normsplash.com), and the same
  table as IRC G2424.1 (415.1) in the *Texas residential code 2018* on UpCodes.
- **UPC-based**: 610.12 in the *Hawaii Plumbing Code 2021* on UpCodes (velocity). **NSPC-based**:
  10.14.1 in the *New Jersey Plumbing Subcode 2021* on UpCodes (velocity).
- **FDA**, "Summary of changes in the 2022 FDA Food Code" (fda.gov).

Could not open: codes.iccsafe.org (403 to the fetcher), copper.org's Copper Tube Handbook (403),
NFPA 96 (free access needs an account; not tried), the Food Code's full text for 5-204.11, IFGC 402
and 409.5 (not in the sample pages), and the UPC itself (IAPMO's reader needs an account; the Hawaii
adoption stood in for 610.12). Those are marked *from memory* below. The UpCodes pages were read
through a fetcher that summarizes; every figure used here was asked for by section and came back
with its section.

---

## PC-REVIEW: chapters 2 to 6 and P-501's fixture units, read as a plumber would

Findings the 2026-09-24 read did not have. The ones it had are under PC-TRADE.

### PC-REVIEW-1. The grease line's slope

- **Claim.** P-101's general notes: "SLOPE WASTE 1/4" PER FT TO 2-1/2", 1/8" PER FT AT 3" AND UP"
  (sheets ~666). The 3" GW lines are drawn under that note.
- **App.** Nothing computes slope. The two GW runs are 37.1 ft (work aisle) and 59.2 ft (bar and
  back rooms) of plan length.
- **Code.** IPC 704.1 (2018, DoD adoption; 2021, Tennessee adoption) sets Table 704.1's 1/8" for 3"
  to 6", "except that where the drainage piping is upstream of a grease interceptor" it is not less
  than 1/4" per foot.
- **Recommendation.** Add 1/4" per foot upstream of the GI to the note; the SS line stays at 1/8".
  The chapter 4 `two` card (29 ft at 1/8", the SS line) stays right. **High**: the exception reads
  the same in both editions opened. On a bid it is depth: 59 ft at 1/4" is about 15" of fall to the
  GI inlet.
- **Tester decides.** Whether the course should teach the exception (a line on `layer` or `gw`), and
  whether the jurisdiction in mind adopts 2018 or later (the exception is not in older editions,
  *from memory*).

### PC-REVIEW-2. Why the hot water loop is there, and the hand-sink temperature

- **Claim.** `water:chain` (~433): "Without the loop the mop sink, forty feet from the heater, runs
  cold ... the health code wants hot water at every hand sink now (FDA Food Code 5-202.12, at least
  100°F)."
- **App.** Along the drawn hot line the mop sink is about 84 ft from the heater (WH out, the south
  wall, up the west trunk to the top wall, east to x 842); the restroom lavatories 67 and 78 ft. The
  return is 40.4 ft, which the card's "forty feet of 3/4" pipe" matches.
- **Code.** IPC 607.2 (2021, Maryland 2024 adoption): the developed length from the source to a
  fixture that needs hot water "shall not exceed 50 feet"; a circulation loop or heat trace counts as
  the source. The 2022 Food Code amended 5-202.12(A) from 100°F to 85°F (FDA summary of changes).
- **Recommendation.** Give the plumbing code's reason first (IPC 607.2, over 50 ft of pipe), and say
  the Food Code wants tempered water at a hand sink (85°F in the 2022 edition, 100°F in earlier
  ones). "Forty feet" should be the pipe's length, about 80. **High** on both facts.
- **Tester decides.** Wording only; and whether to name IECC C404.6 too (607.2 points there for
  circulation controls, *from memory*).

### PC-REVIEW-3. The floor sink's fixture units on P-501

- **Claim.** P-501 row FS-1: W 3", DFU 3 (sheets ~738); note 4: "DRAINAGE LOAD ON P-101: 47 DFU".
- **App.** Nothing computes DFU. By hand: WC 2×4, L 2×1, HS 3×1, 3CS 2×3, MS 1×2, FD 10×2, FS 2×3 =
  47, so the note adds up. U-1 is not on P-101.
- **Code.** IPC 2018 Table 709.1 gives floor sinks no number (note h, "see 709.4") with a 2" trap;
  709.4 makes an indirect waste receptor the sum of what drains to it "but not less than" its value
  in Table 709.1 or 709.2; Table 709.2 gives a 3" trap 5 DFU, a 2" trap 3. (3CS-1 at 3 is above Table
  709.1's plain sink at 2, and matches Table 709.2 for the 2" waste the schedule gives it: fine.)
- **Recommendation.** If the floor sink's trap is the 3" the schedule shows, FS-1 is 5 and the load
  is 51; the 4" sewer still stands (a 3" at 1/8" carries 36, at 1/4" 42). **Medium**: 3 is right for
  a 2" trap, and what the dishwasher adds (709.3, flow-based) is the engineer's figure.
- **Tester decides.** 3 or 5, and whether note 4 and the chapter 1 `units` card follow (47 or 51).

### PC-REVIEW-4. "A flush-valve water closet dumps a tank", and why its waste is 4"

- **Claim.** Chapter 1 `row` (~334) asks "why is its waste 4" when a hand sink's is 1-1/2"?"; `units`
  (~341) answers "WC-1, at 4 DFU: a flush-valve water closet dumps a tank in seconds".
- **App.** P-501 schedules WC-1 at W 4"; P-601 draws a 4" arm.
- **Code.** A flush valve has no tank. IPC 2018 Table 710.1(1)'s footnote sets 3" as the least
  building drain that serves a water closet; Table 709.1 gives a public 1.6 gpf water closet 4 DFU.
- **Recommendation.** "Dumps its flush in seconds". And the 4" is the engineer's choice over a 3"
  code minimum, driven by solids, not by 4 DFU. **Medium**: the wording is certain, the lesson is
  the trade's to frame.
- **Tester decides.** Whether to ask "why 3" or more" instead of "why 4"", or keep 4" as the
  engineer's.

### PC-REVIEW-5. Which fixtures belong in the grease interceptor

- **Claim.** `waste:layer` (~478): "Every kitchen, dish and bar fixture drains through the 3" grease
  line ... the code keeps everything else out (IPC 1003.3)." `waste:two`'s hint on a hand sink (~474):
  "That fixture carries grease".
- **App.** The check accepts WC, L, MS and the restroom FDs; a note on HS, 3CS, FS or a kitchen FD
  gets the hint.
- **Code.** IPC 2018 1003.3.1 lists pot sinks, prerinse sinks, soup kettles, wok stations, floor
  drains or sinks kettles drain to, hood wash units and dishwashers without prerinse sinks; hand
  sinks are not on it. 1003.2: waste that needs no separation "shall not be discharged into any
  interceptor".
- **Recommendation.** Cite 1003.2 for "keeps everything else out", and change the hint's reason: a
  hand sink goes through the GI here because the engineer's red note says ALL KITCHEN WASTE, not
  because it carries grease. **Medium**: many sewer authorities' grease programs do want every
  kitchen drain through, so the drawing is not wrong, but the card's reason is.
- **Tester decides.** The hint's wording, and whether the course should say the local sewer
  authority often decides this.

### PC-REVIEW-6. A hand sink for the dish pit

- **Claim.** `fixtures:kitchen` (~374): the Food Code wants a hand sink in each food preparation area,
  "so the cook line, the dish and prep side and the bar each get one".
- **App.** P-101's three hand sinks are at the bar, the hall wall by the prep sink, and the kitchen
  exit. DISH (x 560 to 700, y 470 to 600) has none; the nearest is through the dish room's door.
- **Code.** Food Code 5-204.11 places hand sinks for convenient use in food preparation, dispensing
  and warewashing areas (*from memory*; the full text was not opened).
- **Recommendation.** Either the card says "the cook line and prep side, the kitchen exit and the
  bar", or the dish pit is an RFI the course could teach. **Low**: "convenient" is the health
  inspector's word.
- **Tester decides.** Reword, or make it a question the reader answers with an RFI.

### PC-REVIEW-7. One primer per floor drain

- **Claim.** `fixtures:primers` (~385): "TYP. means every one ... add a row: Trap primer, 1 per count."
- **App.** Ten FD marks, ten primers.
- **Code.** IPC 2018 1002.4.1 asks for seal protection where a trap is subject to evaporation and
  names primer valves (ASSE 1018, 1044) and barrier devices (ASSE 1072). It does not say one valve
  per drain.
- **Recommendation.** Keep the teaching; add a line that one primer valve with a distribution unit
  often serves several drains, so the bid may carry fewer valves and more small tubing. **Low**:
  practice, not code.
- **Tester decides.** Whether 1 per count is the number an estimator should carry.

### PC-REVIEW-8. The RPZ card

- **Claim.** `water:trunk` (~413): "A reduced-pressure backflow preventer (IPC 608) ... a hose left in
  a mop bucket could siphon the building's water back into the street ... On the bid: one assembly,
  two shutoff valves, a test port and a drain for its relief valve."
- **App.** One RPZ mark.
- **Code.** *From memory*: containment at the service is usually the water purveyor's
  cross-connection rule; the IPC protects at the hazard (a hose thread at a mop sink carries a
  vacuum breaker). An RPZ assembly ships with its two shutoffs and four test cocks.
- **Recommendation.** Name the purveyor as the usual source of a containment RPZ, keep the mop
  bucket as the example of the hazard, and list the bid as the assembly, the relief drain (an air
  gap fitting and a receptor big enough for a full discharge) and the yearly test. **Low**: nothing
  was opened for 608.
- **Tester decides.** The whole card: it is trade practice.

### PC-REVIEW-9. The 4 ft riser on the cold trunk

- **Claim.** `water:drop` (~437): "The trunk comes up out of the slab at the south wall ... choose or
  type 4 ft." The reference takeoff adds 4 ft to the 1.5in trunk.
- **App.** P-101 draws the 2" service coming up at the meter wall (883, 614 to 594), then the
  south-wall run west; the 1-1/2" trunk tees off that run at x 564.
- **Code.** None; the drawing does not say which runs are overhead.
- **Recommendation.** Needs the trade. If the service rises at the meter and runs overhead, the
  vertical is on the 2" at entry and is slab to ceiling (about 9 to 10 ft under a 12 ft deck), not
  4 ft on the trunk. **Low**.
- **Tester decides.** Where the water rises, how far, and on which size.

### PC-REVIEW-10. How P-601 vents the water closet and floor drain

- **Claim.** P-601 draws the WC (10'-0" 4" arm) and FD (4'-0" 2" arm) into the stack under the slab,
  the lavatory's 1-1/2" arm above them, and the stack turning vent above the lavatory.
- **App.** Nothing computes venting.
- **Code.** IPC 2018 912 allows horizontal and vertical wet venting for fixtures "within two
  bathroom groups"; a bathroom group is a WC, a lavatory and a tub or shower (ICC's 2021 brochure,
  reading 202). A public restroom with a WC, a lavatory and a floor drain is not one.
- **Recommendation.** Needs the trade: as drawn the WC and FD are vented through the lavatory's
  drain. Either an individual vent on each, or a riser note naming the venting method. **Low**: this
  is design, and the IPC's stack venting section may cover it (not opened).
- **Tester decides.** Whether the riser is a legal design worth teaching as is.

### PC-REVIEW-11. The dishwasher's indirect waste

- **Claim.** `fixtures:primers` (~385): "The prep sink and the dishwasher: an indirect waste with an
  air gap (IPC 802)."
- **App.** Two FS marks; nothing checks the connection.
- **Code.** IPC 2018 802.1.1: food handling equipment by an air gap; 802.1.6: a commercial
  dishwasher "through an air gap or air break".
- **Recommendation.** "The prep sink by an air gap, the dishwasher by an air gap or an air break".
  **High**.
- **Tester decides.** Wording only.

### PC-REVIEW-12. Checked and right: confirm and move on

Every claim below matched the code text opened (IPC 2018 unless marked).

- `waste:two`: 29 ft at 1/8" per foot is 3-5/8" of fall; Table 704.1 is 1/8" at 3" to 6".
- `sheet:units`: a 3" sewer at 1/8" carries 36 DFU, a 4" 180 (Table 710.1(1)).
- `water:hangers`: copper tubing 1-1/2" and larger hangs at 10 ft (Table 308.5; 6 ft at 1-1/4" and
  smaller, which the 1.25in HW type gets).
- `waste:underslab`: PVC hangs at 4 ft (Table 308.5); pipe in a trench lies on continuous bedding
  (306.2).
- `waste:vents`: a trap seal sees no more than 1 inch of water column (901.2).
- `riser:why` and riser note 3: 10 ft from an opening unless 3 ft above it (903.5); the height above
  the roof is left to the jurisdiction (903.1), so the course's foot is a common figure, not the
  model code's.
- P-501 WSFU: every row matches IPC 2021 Table E103.3(2) public (WC flush valve 10, urinal 3/4"
  flush valve 5, lavatory 2, kitchen sink "hotel, restaurant" 4 for the 3CS, service sink 3).
- P-501 DFU for WC-1 (4), L-1 and HS-1 (1), FD-1 (2), MS-1 (2) match Table 709.1.
- P-501 supply sizes: WC flush valve 1", urinal flush valve 3/4", lavatory 3/8" minimum (Table
  604.5), all met.
- `gas:drops`: a shutoff at every appliance (IFGC 409.5, *from memory*, within 6 ft in the same room).
- `gas:hood` and the RFI spot ahead of the first drop: NFPA 96 10.4, fuel shut off to the equipment
  under the hood on discharge (*from memory*).
- P-101's restrooms, one WC and one lavatory each: IPC Table 403.1 for a restaurant is 1 WC per 75
  per sex and 1 lavatory per 200, and 410.4 waives the drinking fountain where the restaurant serves
  water free, which fits a dining room of this size.

**Recommendation**: keep all of these. **High**. **Tester decides**: nothing, unless their
jurisdiction amends one.

---

## PC-TRADE: the 2026-09-24 findings, researched

### PC-TRADE-1. P-401 contradicts P-101

- **Claim.** P-401 (sheets ~686-726) draws WOMEN left with three WCs, MEN right with two WCs and a
  urinal, rooms 12'-0" × 10'-0", and note 2 "(4) COOK LINE AND BAR STATIONS". P-101 draws MEN left
  (11'-8" × 12'-8") and WOMEN right (10'-10" × 12'-8"), one WC and one lavatory each, and three hand
  sinks. `details:why` (~617) says "count the restrooms on one sheet, never both".
- **App.** The lessons and chapter 7 read P-401's own coordinates (LESSON_DETAIL); nothing compares
  the two sheets.
- **Code.** IPC 2018 Table 403.1 for a restaurant: 1 WC per 75 per sex. P-101's one each fits this
  dining room; P-401's five WCs and a urinal would serve a room several times its size.
- **Recommendation.** Redraw P-401 to P-101 (MEN left, one WC, one lavatory and an FD per room, the
  real room sizes) and make note 2 "(3)", or add a fourth station to P-101. **Medium**: making the
  mismatch an RFI teaches something true, but "count one, bid four" then has no right answer, and a
  redraw moves every P-401 coordinate in features/lessons.js and chapter 7.
- **Tester decides.** Redraw or RFI, and three stations or four.

### PC-TRADE-2. The trap arm table

- **Claim.** `riser:stack` (~542): "IPC Table 1002.2 allows six feet for a 1-1/2" arm"; riser note 2
  says the same with 2" 8'-0" and 4" 16'-0".
- **App.** Nothing applies it; the step's check passes on any 4 ft measurement on P-601 (the FD arm
  too; see the agent list).
- **Code.** IPC 2021 Table 909.1 (ICC brochure): 1-1/4" 5 ft, 1-1/2" 6 ft, 2" 8 ft, 3" 12 ft, 4"
  16 ft. IPC 2018 1002.2 is "Design of traps", not a length table. The UPC's Table 1002.2 is its
  trap-arm table, at 3'-6" for 1-1/2" (*from memory*), which would fail this arm.
- **Recommendation.** Change the card and the note to IPC Table 909.1; the numbers stay. Also "any
  longer and the trap would siphon when the water closet flushes" is better said as the arm running
  full and siphoning its own trap. **High** on the citation, medium on the wording.
- **Tester decides.** Confirm; and whether the course should mention that a UPC jurisdiction reads a
  shorter table.

### PC-TRADE-3. Gas hanger spacing

- **Claim.** `gas:hangers` (~597): "IPC Table 308.5 hangs steel pipe every 12 ft" and the action adds
  Hanger · 1 per 12 ft to 1.25in BI.
- **App.** No steel row is offered; the reader types 12 ft; rule plumb.hanger.steel is a draft.
- **Code.** IPC 2018 Table 308.5 does say steel pipe 12 ft horizontal. But gas piping is under the
  fuel gas code: IFGC 2021 Table 415.1, steel 1/2" 6 ft, 3/4" or 1" 8 ft, 1-1/4" or larger 10 ft
  horizontal, vertical at every floor level.
- **Recommendation.** Teach 10 ft from IFGC Table 415.1 (the 1-1/4" and the 1-1/2" both 10 ft) and
  say the plumbing code's 12 ft is for steel water and waste pipe. **High**.
- **Tester decides.** Confirm; the rulebook then needs a fuel gas hanger rule, not the IPC steel row.

### PC-TRADE-4. The gas main's two sizes

- **Claim.** `gas:meter`'s reveal (~566): 1-1/2" from the meter into STORAGE, 3/4" to the WH, 1-1/4"
  on to the cook line. The chapter then makes one 1.25in BI type and traces meter to range with it;
  the reference (RUNS ~232) does too.
- **App.** The traced main is 35.5 ft. P-101 labels 1-1/2" at y 520 (inside STORAGE, past the WH tee
  at y 582) and 1-1/4" at y 420 (the kitchen); the storage/kitchen wall is at y 470. No reducer is
  drawn. So about 13.5 ft is 1-1/2" (meter to the wall) and 22 ft 1-1/4".
- **Code.** IFGC 402 sizes each section by the load downstream (*from memory*), so the reveal is
  right; the takeoff is not.
- **Recommendation.** Two line types, 1.5in BI from the meter to the storage/kitchen wall and 1.25in
  BI from there, with the reference split the same way; or draw a reducer symbol so the change is
  not inferred. **Medium**: the arithmetic is certain, where the reducer sits is read off labels.
- **Tester decides.** Where the size changes, and whether the chapter should trace two runs.

### PC-TRADE-5. U-1 and WC-1 share 4 DFU

- **Claim.** `sheet:row` (~334-337) wants the row with the biggest DFU; U-1 (4) ties WC-1 (4), and a
  reader who picks U-1 is told to look for a bigger number. P-101 has no urinal.
- **App.** The check passes only on WC-1's row (y 169).
- **Code.** IPC 2018 Table 709.1: urinal 4 DFU, "urinal, 1 gallon per flush or less" 2. A new
  flush-valve urinal in the US is 1 gpf or less (the federal limit, *from memory*), so 2 is the row.
- **Recommendation.** U-1 to 2 DFU; WC-1 is then the only 4. **High** on the table, medium on the
  federal limit being the whole story. Separately, say on `fixtures:counters` that U-1 is on the
  schedule and not on this plan (a row with nothing drawn is itself an RFI), or drop the row if P-401
  loses its urinal (PC-TRADE-1).
- **Tester decides.** 2 DFU; and keep or drop U-1 with P-401.

### PC-TRADE-6. Cleanouts

- **Claim.** P-101's note: "CLEANOUTS AT EACH UPSTREAM END, EACH TURN, 100 FT MAX APART". The sheet
  draws four: the upstream end of the SS and of both GW lines, and the SS's turn outside.
  `waste:vents` (~502): "Four: at the upstream end of each drain line and at the turn outside ...
  (IPC 708)."
- **App.** The check counts those four; extra marks at the GW turns are kept in the takeoff.
- **Code.** IPC 2018 708.1: every 100 ft (708.1.1), near the building drain and sewer junction
  (708.1.3), and at a change of horizontal direction over 45 degrees, one cleanout at the first
  change serving the others within 40 ft (708.1.4). No upstream-end rule and no base-of-stack rule
  in the 2018 list. The upstream end is the UPC's (707.4, *from memory*).
- **Recommendation.** Under the IPC the GW lines want a cleanout at their first turns (the aisle run
  at x 900, y 436; the back-room run at its jog, x 440), six in all; the upstream-end ones are the
  engineer's choice. Either add those two to the sheet and the check, or make the note match what is
  drawn. Cite 708.1.4 for the turn outside and the note for the upstream ends. **Medium**.
- **Tester decides.** Four or six, and whether P-601's base-of-stack cleanout (riser note 4) stays as
  the engineer's note.

### PC-TRADE-7. The wet wall

- **Claim.** `fixtures:wetwall` (~354): "every fixture in both rooms sits against that wall or the top
  wall"; `counters` (~359): "Eleven feet. A wet wall ... back to back".
- **App.** The measure is WC to WC (596 to 732, 11.3 ft). The shared wall is x 700; MEN's lavatory
  hangs on MEN's west wall (x 560), WOMEN's on the shared wall; the rooms repeat, they do not mirror.
- **Code.** None; this is what the drawing shows.
- **Recommendation.** Either mirror MEN on P-101 (lavatory and WC against the shared wall; the
  lessons' LAVS and WCS coordinates move) or reword: the two rooms share the top wall's run and one
  stack, and the reading is the distance between the WCs. **Medium**.
- **Tester decides.** Redraw or reword.

### PC-TRADE-8. Which hand sink serves the cook line

- **Claim.** `fixtures:handsinks` (~369-371): "Click the one hand sink that serves the cooks at the
  range"; the hint points to the row under HOOD ABOVE.
- **App.** The right one (600, 308) is about 8 ft from the range with the prep sink between; the exit
  one (928, 392) is about 8 ft from the east fryer, across the aisle.
- **Code.** Food Code 5-204.11, "convenient use" (*from memory*); no distance.
- **Recommendation.** Ask "which hand sink sits on the cook line's wall", or move the exit sink away,
  so the answer does not rest on a distance the two share. **Medium**.
- **Tester decides.** Which of the two the trade would call the cook line's.

### PC-TRADE-9. Words that do not match the sheet

- **Claim.** `gas:trace` and `gas:drops` (~574, ~584) say the run is "behind the cook line".
- **App.** The gas is drawn at y 346, on the aisle side of the equipment (y 302 to 338, against the
  wall at 296).
- **Code.** None. In practice gas drops come down behind the equipment at the wall, so a plumber
  reads the drawing as the odd part, not the words.
- **Recommendation.** Move the gas run to the wall side on P-101 (the drop and valve spots move with
  it) or change the words to "in front of". **Medium**. (The other two word items, ten 1/2" lines
  and nine words, are not trade; see the agent list.)
- **Tester decides.** Redraw or reword.

---

## PT-TRADE: three numbers the plumbing tour teaches

### PT-TRADE-1. The 8 fps cold cap: code or practice?

- **Claim.** Tour step `size` (features/tutorial.js ~600): "the sizes that keep the water under 8 fps:
  1in holds, and 3/4in would do too. The smaller pipe that still holds is the one to bid". Rule
  plumb.water.velocity: "No model code prints a velocity limit for water pipe."
- **App.** water-model.js `WATER_VELOCITY_CAP_FPS = { cold: 8, hot: 5 }`. Three public lavatories,
  4.5 cold WSFU, 8.7 gpm (flush-tank column): 1/2" PEX 15.8 fps, 3/4" 7.9, 1" 4.8. The app offers
  3/4".
- **Code.** The IPC's Appendix E pages opened (E-9 to E-11, 2021) print no velocity; the body prints
  none either (*from memory*). The UPC does: 610.12 in the Hawaii Plumbing Code 2021 caps copper
  tube, and copper fittings in other tubing, at 8 ft/s cold and 5 hot. The NSPC-based New Jersey
  subcode 10.14.1 caps all distribution piping at 8 fps and hot water in copper at 5.
- **Recommendation.** Keep 8 and 5. Correct the rule's sentence: design practice under the IPC, code
  under the UPC (copper, and PEX with brass or copper fittings) and the NSPC. **High** on the facts.
- **Tester decides.** Whether the tour should say "practice" or "the UPC's limit"; and whether 3/4"
  PEX at 7.9 fps, 0.1 under the cap before the fittings' smaller bore, is the size a plumber would
  bid or would step up.

### PT-TRADE-2. The lavatory's 2 WSFU and the cold branch

- **Claim.** Tour step `wsfu` (~587): "In [[Fixture units]], type 2. The app reads 2 WSFU for a public
  lavatory". The persona worry (C24): the cold branch is then sized on the total, not the cold load.
- **App.** It is not. `waterFixtureLoads` scales the typed number by the table row, so 2 on a
  lavatory is 1.5 cold and 1.5 hot, and the cold branch sees 4.5 for three (run in node against
  water-model.js). On 6, the totals, 3/4" PEX would run 9.7 fps and fail, so the tour's own answer
  depends on this.
- **Code.** IPC 2021 Table E103.3(2): lavatory, public, faucet: 1.5 cold, 1.5 hot, 2.0 total;
  footnote a: the separate hot and cold loads are "three-fourths of the total load".
- **Recommendation.** Keep. **High**. A line on the card that the cold side carries 1.5 of the 2
  would stop the question (agent list).
- **Tester decides.** Nothing beyond confirming.

### PT-TRADE-3. PEX hangers at 32 in

- **Claim.** Tour step `hangers` (~569): "Hanger · 1 per 32 in (the International Plumbing Code (IPC)
  spacing for PEX at 1 in ...)".
- **App.** support-model.js `HANGER_SPACING.pex`: 32 in at 1" and smaller, 48 in above, 10 ft
  vertical.
- **Code.** IPC 2018 Table 308.5: PEX 1" and smaller 2.67 ft (32 in) horizontal, 1-1/4" and larger
  4 ft, 10 ft vertical, with a mid-story guide for 2" and smaller.
- **Recommendation.** Keep. **High**.
- **Tester decides.** Nothing, unless their jurisdiction or the PEX maker allows a continuous support
  channel at longer spans (*from memory*), which the rule could mention.

---

## For the tester

**Confirm these (high confidence: say yes or no).**

1. PC-TRADE-2: the trap arm table is IPC Table 909.1, not 1002.2; the numbers stay.
2. PC-TRADE-3: gas hangers at 10 ft from IFGC Table 415.1, not 12 ft from IPC 308.5.
3. PC-TRADE-5: U-1 at 2 DFU (a urinal of 1 gpf or less), which breaks the tie with WC-1.
4. PC-REVIEW-1: 1/4" per foot upstream of the grease interceptor (IPC 704.1), on the sheet's note.
5. PC-REVIEW-2: the loop is required by IPC 607.2 (over 50 ft); the 2022 Food Code's hand sink is
   85°F; the mop sink is about 80 ft of pipe from the heater, not forty.
6. PC-REVIEW-11: the dishwasher may use an air break.
7. PC-REVIEW-12: the list of claims that checked out.
8. PT-TRADE-1: keep 8 and 5 fps; code under the UPC and the NSPC, practice under the IPC.
9. PT-TRADE-2: keep; the app already sizes on the cold 1.5.
10. PT-TRADE-3: keep 32 in.

**Decide these (your judgment).**

1. PC-TRADE-1: redraw P-401 to match P-101, or teach the mismatch as an RFI; three stations or four.
2. PC-TRADE-6: four cleanouts or six (the GW lines' first turns under IPC 708.1.4).
3. PC-TRADE-4: where the gas steps from 1-1/2" to 1-1/4", and two line types in the chapter.
4. PC-REVIEW-3: FS-1 at 3 or 5 DFU, and 47 or 51 on the note.
5. PC-REVIEW-5: why a hand sink goes through the GI (the engineer's note, not grease).
6. PC-TRADE-7 and PC-TRADE-9: redraw or reword (the wet wall; the gas behind or in front).
7. PC-TRADE-8: which hand sink is the cook line's.
8. PC-REVIEW-4: how to frame the WC's 4" waste.
9. PC-REVIEW-6: a hand sink for the dish pit.
10. PC-REVIEW-9: where and how far the water rises.
11. PC-REVIEW-10: whether P-601's venting is a design to teach.
12. PC-REVIEW-7 and PC-REVIEW-8: primers per drain, and the RPZ card.
13. PT-TRADE-1's second half: bid 3/4" PEX at 7.9 fps, or step up.

## Not trade: for an agent

Wording and app issues found on the way. None needs the trade.

- `riser:traparm`'s check (`K().measured(K().P601, 4, 0.3)`) passes on any 4 ft reading on P-601,
  so the FD's 4'-0" arm passes too (already in PLUMBING-COURSE.md's list). **Fixed 2026-09-27
  (DS-AGENT-NITS): the reading counts only with a click at each end of the lavatory's arm.**
- `fixtures:keys` says ten primers "and ten little 1/2" lines" ride the marks; only the primer row
  was added. `waste:layer` says the red note is nine words; it is seven (both already listed).
  **Fixed 2026-09-27 (DS-AGENT-NITS).**
- Chapter 2's `done`: "Twenty-two fixtures under eight schedule tags". The 22 are under seven tags;
  U-1 has none on P-101. **Fixed 2026-09-27 (DS-AGENT-NITS).**
- WATER-PLAN.md §7's worked example reads 4.5 WSFU as about 4 gpm; the table and the app
  (water-model.test.js) say 8.7, so the example's velocities are off. Documentation only.
  **Fixed 2026-09-27 (DS-AGENT-NITS): recomputed from the model.**
- The tour's `wsfu` and `size` cards: the reader types 2 per lavatory and the sizing reads 1.5 cold
  each. One line saying so would pre-empt PT-TRADE-2's question. (What the water card displays as
  the fixture units still to serve was not checked live.) **Fixed 2026-09-27 (DS-AGENT-NITS):
  checked live, the card reads 4.5 WSFU downstream for the three lavatories; both cards say why.**
- After the tester rules, these follow the ruling: the rulebook drafts plumb.hanger.steel (becomes a
  fuel gas rule), plumb.drain.slope (the interceptor exception), plumb.drain.cleanouts (708.1.4's
  first change), plumb.waste.grease-interceptor (1003.2) and plumb.water.velocity (the UPC and the
  NSPC); plumb.trap.arm-length already says 909.1. And RUNS in the course if the gas main splits.

## Settled 2026-09-27

Settled by Claude on the owner's delegation ("go through and answer all these questions"), from
this dossier's research and the model code text as quoted here; nobody opened a printed code book
or a local amendment, and the cards still say "read the edition your jurisdiction adopts" where
they did. PC-TRADE-2 and PC-TRADE-3 belong to the plumbing rules dossier's PR (the rulebook and
the cards that cite it) and were not touched here. Branch `claude/dossier-plumbing-course`.

**Confirm entries**

- PC-TRADE-2 (trap arm table, 909.1 for 1002.2): OWNED BY THE RULES PR. Not touched here: the
  `riser:stack` card, P-601's riser note 2 and chapter 9's `rows` reveal still say Table 1002.2.
- PC-TRADE-3 (gas hangers at 10 ft, IFGC 415.1): OWNED BY THE RULES PR. Not touched here. Note for
  that PR: the gas main is now two types (PC-TRADE-4); the `gas:hangers` step still reads `RE.gas`,
  which now names the 1.25in BI type only, so its row lands on the 1-1/4" run and the 1.5in BI
  run counts no hangers unless that PR adds the row to both.
- PC-TRADE-5 (U-1 at 2 DFU): APPLIED. P-501's U-1 row reads 2 (IPC Table 709.1, a urinal of 1 gpf
  or less), so WC-1 is the only 4 and `sheet:row`'s "the biggest number" has one answer. U-1 stays
  on the schedule (P-401 draws the urinal); `fixtures:restrooms` now says U-1 has a row and no
  symbol on P-101, and that a row with nothing drawn is a question for an RFI.
- PC-REVIEW-1 (1/4" per foot upstream of the GI): APPLIED. P-101's slope note reads `SLOPE 1/4"
  PER FT TO 2-1/2" AND ALL GW, 1/8" PER FT AT 3" AND UP.`; `waste:gw` teaches it (IPC 704.1, 59 ft
  of the back-room run is about 15" of fall) and names plumb.drain.slope. The SS line stays at 1/8";
  `waste:two` is unchanged.
- PC-REVIEW-2 (the loop, 607.2; 85°F; about 80 ft): APPLIED on `water:chain`: the mop sink is about
  eighty feet of pipe from the heater, the plumbing code wants a loop past fifty feet (IPC 607.2,
  `rulesExempt`: no rule holds 607.2 yet), and the Food Code's hand sink is at least 85°F in 2022,
  100°F before (5-202.12). The return stays "forty feet" (its own length, 40.4 ft). IECC C404.6 not
  named (the dossier had it from memory).
- PC-REVIEW-11 (the dishwasher's air break): APPLIED on `fixtures:primers`: the prep sink by an air
  gap, the dishwasher by an air gap or an air break (IPC 802).
- PC-REVIEW-12 (the list that checked out): APPLIED (kept, no edit) for every item read from an
  opened source. LEFT OPEN: the two items the dossier had *from memory*, IFGC 409.5 (`gas:drops`)
  and NFPA 96 10.4 (`gas:hood`); the cards are unchanged, and the sources were not opened.
- PT-TRADE-1 first half (8 and 5 fps): APPLIED on the tour's `size` card: under the IPC the limit
  is design practice, the UPC makes it code for copper. The rule's sentence ("No model code prints
  a velocity limit") is the rulebook's to correct (plumb.water.velocity: practice under the IPC,
  code under UPC 610.12 and NSPC 10.14.1); LEFT OPEN here because content/rules/ is outside this PR.
- PT-TRADE-2 (the cold side of 2 WSFU): ALREADY DONE (the tour's `wsfu` and `size` cards say the
  cold side carries 1.5 of the 2, DS-AGENT-NITS); the app already sizes on it. Nothing to change.
- PT-TRADE-3 (PEX at 32 in): APPLIED (kept, no edit).

**Decide entries**

- PC-TRADE-1 (P-401 against P-101): APPLIED as words, not a redraw: `details:why` now says this
  P-401 does not match P-101 (rooms swapped, five WCs and a urinal against one WC a room) and that
  two sheets that disagree are counted on neither until an RFI says which governs; `details:read`
  says note 2 asks for four stations where P-101 draws three hand sinks, so bid the four and ask
  where the fourth goes. Four stations, not three (the count that does not under-count).
- PC-TRADE-6 (four cleanouts or six): APPLIED, six. P-101 gains a cleanout at the grease lines'
  first turns (plan 900,436 and 440,544; nothing moved), its note reads `CLEANOUTS AT EACH UPSTREAM
  END AND FIRST TURN, 100 FT MAX APART.`, the `waste:cleanouts` check wants six, `waste:vents`
  answers six (the upstream ends the engineer's choice, the first turns IPC 708.1.4), and the
  reference counts 36 marks. P-601's base-of-stack cleanout stays as the engineer's riser note 4.
- PC-TRADE-4 (the gas main's sizes): APPLIED. Chapter 6 makes 1.5in BI and 1.25in BI, traces the
  1-1/2" from the meter to the storage/kitchen wall (13.5 ft) and the 1-1/4" from there to the
  range (22.0 ft), and says no reducer is drawn, so the change is read at the wall between the two
  labels and the reducer is a fitting on the bid. `RUNS` (the reference) splits the same way.
- PC-REVIEW-3 (FS-1 at 3 or 5): APPLIED, 5 (a 3" trap, Table 709.2 through 709.4), so note 4 and
  the `sheet:units` and `bid:rows` cards read 51 DFU; the 4" sewer still stands (a 3" carries 36).
- PC-REVIEW-5 (why a hand sink goes through the GI): APPLIED. `waste:layer` cites IPC 1003.2 for
  keeping waste that needs no interceptor out, and says a hand sink goes to the GI here because the
  red note sends ALL KITCHEN WASTE, as many sewer offices want; `waste:two`'s hint says the same
  instead of "that fixture carries grease".
- PC-TRADE-7 (the wet wall): APPLIED as words. The WCs sit on the top wall and the stack in the
  wall between the rooms; the reading is water closet to water closet; the rooms repeat, not
  mirror; a wet wall (fixtures back to back) is described, not claimed.
- PC-TRADE-9 (gas behind or in front): APPLIED as words. `gas:trace` and `gas:drops` say "in front
  of the cook line", and `gas:drops` notes most sheets run it behind at the wall.
- PC-TRADE-8 (which hand sink): APPLIED. `fixtures:handsinks` asks for the hand sink on the cook
  line's own wall (the hall wall the equipment stands against); the answer is the one past the prep
  sink, `HAND_SINKS[1]`, as before.
- PC-REVIEW-4 (the WC's 4" waste): wording ALREADY DONE (the card already said "dumps its water in
  seconds", not "a tank"); framing APPLIED on `sheet:units`: the 4" is the engineer's choice, the
  code's least for a building drain a water closet empties into is 3" (IPC Table 710.1(1)), and
  solids, not the 4 DFU, set it. The question stays "why 4"".
- PC-REVIEW-6 (a hand sink for the dish pit): APPLIED as the reword: "the cook line and prep side,
  the kitchen exit and the bar". The Food Code 5-204.11 text itself was not opened (LEFT OPEN as a
  source to read; the card's citation is unchanged).
- PC-REVIEW-9 (where and how far the water rises): LEFT OPEN. Nothing on the sheet or in the
  sources says which runs are overhead, so any location or length would be invented. The `water:drop`
  card no longer claims the trunk rises 4 ft at the south wall: it says the sheet does not say
  where the water rises or how far, that the 4 ft is practice, and that on a real bid it is an RFI.
  The reference still carries 4 ft on the trunk.
- PC-REVIEW-10 (P-601's venting): LEFT OPEN. The dossier's reading (the WC and FD wet vented
  through the lavatory's drain, which IPC 912 allows only within bathroom groups) rests on a
  section it opened, but it did not open the stack-venting section that could cover this riser;
  no sheet or card changed.
- PC-REVIEW-7 (primers per drain): APPLIED. The row stays 1 per count; `fixtures:primers` adds that
  one primer valve with a small manifold can serve several drains, so a bid may carry fewer valves
  and more small tubing.
- PC-REVIEW-8 (the RPZ card): APPLIED as trade practice: the water utility usually asks for the
  service RPZ; the bid is the assembly (its two shutoffs and test ports come with it), a relief
  drain (an air gap fitting over a drain big enough for a full dump) and a yearly test. The IPC 608
  citation is unchanged and was not opened.
- PT-TRADE-1 second half (3/4" PEX at 7.9 fps): APPLIED, step up. The tour's `size` card says 3/4in
  holds just under the limit, that a fitting is narrower inside than the pipe so a careful bid
  stays at 1in, and to take 3/4in there only to see how S works. The app's sizing is unchanged.

**Not trade: for an agent**

- `riser:traparm`'s loose check; `fixtures:keys`' ten 1/2" lines and `waste:layer`'s nine words;
  chapter 2's `done` tag count; WATER-PLAN §7's worked example; the tour's `wsfu` / `size` cold-side
  line: ALREADY DONE (DS-AGENT-NITS, PR #231; verified on main).
- The rulebook drafts that follow the rulings: named for the rulebook's owner, not edited here
  (content/rules/ is outside this PR): plumb.drain.slope (the 704.1 row upstream of an
  interceptor), plumb.drain.cleanouts (708.1.4's first change; its body says "four"),
  plumb.waste.grease-interceptor (cite 1003.2 for "kept out"), plumb.waste.indirect (its Verify
  paragraph says the card gives an air gap for both), plumb.drain.dfu-capacity (its body says 47
  and "dumps a tank"), plumb.water.velocity (the UPC and NSPC sentence). LEFT OPEN.
- RUNS in the course if the gas main splits: APPLIED (PC-TRADE-4).

### Looked up later the same day

- **PC-REVIEW-9:** settled as teaching. The card keeps 4 ft as practice and an RFI, and adds the usual route: the service rises where it enters, the pipe runs above the ceiling, a pipe down the wall at each fixture. APPLIED
- **PC-REVIEW-10:** the riser is a vertical wet vent, IPC 912.1.1 (read in the IPC 2021 as Colorado adopts it, with the definition of a bathroom group). Riser note 5 names the method and says to verify with the authority; the card says so. Confidence medium: whether a public restroom counts as a bathroom group is the authority's reading. APPLIED
- **IFGC 409.5, Food Code 5-204.11, IPC 608:** confirmed (409.5 in the residential code's copy, G2420.5; 5-204.11 in summaries of the 2022 Food Code; 608.1 read in the IPC 2021). **NFPA 96 10.4:** still unread in the standard, RULEBOOK-SIGN.

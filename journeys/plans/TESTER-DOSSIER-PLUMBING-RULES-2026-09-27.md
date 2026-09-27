# Tester dossier: the water tables and the plumbing drafts (2026-09-27)

The research half of two punch rows, so the person with the trade confirms or rejects instead of
starting from nothing. **WATER-TABLES** is the six water-sizing rules the S moment will stand on;
**RULEBOOK-SIGN (plumbing)** is the thirteen `status: draft` plumbing rules the course cites.

An agent wrote this. Per PERSONA-PLAN "Who does what", code and trade truth is settled by a person
with the trade, never by an agent's edit, so nothing here changed a rule, a card, a sheet or a line
of code, and no punch row is closed. Every recommendation below is a proposal for the tester.

## How to read an entry

Each entry gives, in order: the rule's values as its file states them; what the public code text
says, with the source actually opened (or "from memory" where nothing opened); for the water rules,
whether water-model.js agrees; the drafter's doubt and an answer to it; a recommendation with a
confidence; and what the tester still has to decide.

**Where the public text came from.** ICC's own viewer (codes.iccsafe.org) refused every fetch
(HTTP 403). What opened:

- **UpCodes, the Colorado adoption of the IPC 2021** (up.codes/viewer/colorado/ipc-2021): Appendix E,
  Chapters 3, 6, 7, 8, 9 and 10. Colorado amends the IPC, so where a figure could be a state
  amendment the entry says so and names a second copy.
- **UpCodes, other adoptions**: Tennessee IPC 2021 (704.1), Department of Defense IPC 2018
  (704.1, 708.1), Maryland 2024 (903.1, Table 604.5), Hawaii 2021 (a UPC adoption, 610.12),
  NFPA 1 2021 (50.5.3, which extracts NFPA 96 10.4), and the IRC 2024 fuel gas chapter (G2424.1,
  which mirrors IFGC 415.1).
- **The 2018 Seattle Fuel Gas Code, Chapter 4** (seattle.gov PDF, the IFGC 2018 with Seattle
  amendments marked [S]): 402.4, 409.5 and Table 415.1, read as text.
- **The UPC 2018, Chapter 10** as Nevada adopted it (an UpCodes export a city posted): Table 1002.2,
  1005.1, 1007.1, 1014.1, read as text.
- **Manufacturer and reference pages**: copper.org (Copper Tube Handbook velocity), PEXUniverse and
  supplier listings for Uponor AquaPEX bores, Engineering ToolBox (Type L copper, CTS CPVC).

What did not open: NFPA 96 itself (NFPA's free-access reader needs a login; the 2011 copy online
refused the connection), the ICC viewer for any code, the UPC 2021 chapters beyond the Hawaii
velocity section, and ASTM's standards (paywalled). Where an entry leans on those, it says "from
memory".

Most tables were read through a web-fetch tool that summarizes a page; the numbers it returned
matched the app to the decimal, including the odd ones (61.2, 64.3, 85.5, 95.5 in the demand curve),
which is hard to do by chance. The tester still reads the printed book: this dossier narrows what to
look at, it does not replace the look.

---

## WATER-TABLES: the six water-sizing rules

Setup check, run in this branch: `node --test water-model.test.js rules.test.js` passes (23 tests),
and `npm run build:rules -- --check` reports "Rules up to date (52 rules, 275 values checked against
code)". So every value row below equals water-model.js today; the question for each rule is only
whether both equal the code book.

### 1. plumb.wsfu.fixtures: water supply fixture units by fixture

**Values.** 73 rows from IPC Table E103.3(2), cold / hot / total per fixture, occupancy and control:
bathroom group private (flush tank 2.7 / 1.5 / 3.6; flush valve 6 / 3 / 8); bathtub (private 1 / 1 /
1.4; public 3 / 3 / 4); bidet private 1.5 / 1.5 / 2; combination fixture private 2.25 / 2.25 / 3;
dishwashing machine private hot 1.4, total 1.4; drinking fountain public 3/8 in valve cold 0.25;
kitchen sink (private 1 / 1 / 1.4; public 3 / 3 / 4); laundry trays private 1 / 1 / 1.4; lavatory
(private 0.5 / 0.5 / 0.7; public 1.5 / 1.5 / 2); service sink public 2.25 / 2.25 / 3; shower head
(private 1 / 1 / 1.4; public 3 / 3 / 4); urinal public (3/4 in flush valve 5; 1 in flush valve 10;
flush tank 3); washing machine 8 lb (private 1 / 1 / 1.4; public 2.25 / 2.25 / 3); washing machine
15 lb public 3 / 3 / 4; water closet (private flush tank 2.2, flush valve 6; public flush valve 10,
flush tank 5; flushometer tank 2, either column).

**Public text.** IPC 2021 Table E103.3(2), opened on UpCodes (Colorado IPC 2021). All 27 printed rows
match the rule and `WSFU_LOADS` exactly, including the three columns and the dashes where a fixture
has no hot side. The book says "flushometer valve" where the app says "flush valve"; that is wording,
not a number. The book's occupancy column reads "Offices, etc." for the drinking fountain and the
service sink and "Hotel, restaurant" for the public kitchen sink, which the rule's body says it maps
to the public column.

**water-model.js agrees.** Yes, all 27 rows (read by eye against the fetched table; the drift check
ties the rule to the code).

**The drafter's doubt.** None written. The one judgment inside is the mapping of "Offices, etc." and
"Hotel, restaurant" to public; that is how the table is read in practice.

**Recommendation.** Sign as is. **Confidence: high.** Every number matched a 2021 adoption.

**The tester decides.** Confirm against the printed 2021 book and, since the rule claims 2018 too,
the 2018 book (I found no sign the table changed, but I opened only the 2021 copy).

### 2. plumb.wsfu.demand: the demand curve

**Values.** 100 rows, IPC Table E103.3(3): the flush-tank column from 1 WSFU (3 gpm) to 5,000 WSFU
(593 gpm), and the flush-valve column from 5 WSFU (15 gpm) to 5,000 (593), the two columns equal from
1,000 WSFU up.

**Public text.** IPC 2021 Table E103.3(3), opened on UpCodes (Colorado IPC 2021). Every one of the
100 points matched: for example flush tanks 50 WSFU 29.1 gpm and 100 WSFU 43.5; flush valves 30 WSFU
42, 80 WSFU 61.2, 225 WSFU 95.5, 500 WSFU 143.

**water-model.js agrees.** Yes, `DEMAND_CURVE` holds exactly those points.

**The drafter's doubt.** None written. One claim in the body I could not confirm: "Between the
printed points the code has you interpolate on a straight line." The Appendix E text I could open
has no interpolation instruction in the table or its notes. Interpolating is ordinary practice with
this table, so the app's behavior is fine; the sentence attributes it to the code.

**Recommendation.** Sign the values as is. Soften the one sentence to "the app interpolates on a
straight line between the printed points" unless the tester finds the instruction in the book.
**Confidence: high** on the values, **medium** on the interpolation sentence.

**The tester decides.** Whether the book says to interpolate. Also the three app conventions the
body already states plainly (a flush-valve load under 5 WSFU reads the flush-tank column; under 1
WSFU the flow falls to zero with the load; past 5,000 the last value holds): they are the app's,
not the code's, and the tester only confirms they are sensible for a walk-through size.

### 3. plumb.water.velocity: the design velocity

**Values.** Cold water 8 fps; hot water 5 fps. `kind: convention`, cited to ASPE and the Copper
Development Association.

**Public text.** The Copper Tube Handbook (copper.org, "Pressure System Sizing") says not to exceed 8
fps cold and 5 fps hot up to about 140 °F, and 2 to 3 fps where water routinely runs hotter. That
matches the values. But the rule's body opens with "No model code prints a velocity limit for water
pipe", and that is not right: **the Uniform Plumbing Code does.** The Hawaii Plumbing Code 2021 (a UPC
2021 adoption, opened on UpCodes) carries **610.12** in the main body, capping copper and copper-alloy
tube systems at 8 ft/s cold and 5 ft/s hot. The IPC's own Appendix E (Colorado 2021 copy) has no
figure, but its E103.3 method sizes against a designer's "selected velocity" and E103.2.2 points to
"manufacturers' tables and velocity recommendations". From memory, not seen: the printed friction-loss
charts in the IPC's Figure E103.3 series carry a note that velocities over 5 to 8 feet per second are
not usually recommended; the figures are images and did not come through the fetch.

**water-model.js agrees.** Yes, `WATER_VELOCITY_CAP_FPS = { cold: 8, hot: 5 }`.

**The drafter's doubt.** None written.

**Recommendation.** Keep the values. Change the body's first sentence to say the IPC prints no
velocity limit while the UPC (610.12 in 2021) caps copper at the same 8 and 5; consider adding the
UPC as a second source so a UPC-state estimator sees the figure is code there. **Confidence: medium
to high** (the UPC section opened in a state adoption, not in IAPMO's own book).

**The tester decides.** Whether the rule stays `convention` (right under the IPC) with a UPC note,
or carries the UPC as its source. And whether the hot cap should drop for hot water above 140 °F
(the handbook's 2 to 3 fps), for example on a recirculated or 160 °F kitchen loop; the app has one
hot cap per project, editable on the schedule.

### 4. plumb.water.pipe-id: inside diameters by nominal size

**Values.** PEX SDR 9: 3/8 in 0.35, 1/2 0.475, 3/4 0.671, 1 0.862, 1-1/4 1.054, 1-1/2 1.244, 2
1.629. Copper Type L: 3/8 0.43, 1/2 0.545, 3/4 0.785, 1 1.025, 1-1/4 1.265, 1-1/2 1.505, 2 1.985,
2-1/2 2.465, 3 2.945. CPVC CTS SDR 11: 1/2 0.489, 3/4 0.715, 1 0.921, 1-1/4 1.125, 1-1/2 1.329, 2
1.739. Schedule 40 steel: 1/2 0.622, 3/4 0.824, 1 1.049, 1-1/4 1.38, 1-1/2 1.61, 2 2.067, 2-1/2
2.469, 3 3.068.

**Public text.** The ASTM standards are paywalled; I read published dimension tables instead.

- **Copper Type L** matches the ASTM B88 table on Engineering ToolBox at every size (one line of that
  page misprints the 3/4 in outside diameter; the 0.785 bore is the standard 0.875 OD less two 0.045
  walls, and a second search result gives the same 0.785).
- **Schedule 40 steel** is the standard pipe schedule; the eight bores are the textbook figures (from
  memory, and not in doubt).
- **PEX**: the app's bores are Uponor's published AquaPEX figures (supplier listings show 3/4 in
  "0.671 in inside" and 1 in 0.862). They run about 0.01 in under the outside diameter less two
  *minimum* walls (PEXUniverse lists 1/2 in 0.485, 3/4 in 0.681, 1 in 0.875), because they allow for
  the wall's plus tolerance. That errs toward a slightly higher velocity, which is the safe side.
- **CPVC**: the app's bores are the outside diameter less two *minimum* walls (Engineering ToolBox
  gives 0.715, 0.921, 1.125, 1.329, 1.739 the same way; 1/2 in at 0.489 uses D2846's 0.068 minimum
  wall, as the body says). A search result quoting a CPVC maker gives 1/2 in 0.469, 3/4 in 0.695, 1
  in 0.901, the bore at a thicker, mid-tolerance wall.

**water-model.js agrees.** Yes, `PIPE_ID_IN` holds exactly these values.

**The drafter's doubt.** None written. What I found is an inconsistency of method, not a wrong
number: PEX uses a bore that allows for wall tolerance, CPVC uses the largest possible bore. At 1/2
in the gap is about 9 percent in velocity (0.489 against 0.469, squared), so a CPVC branch near the
cap could be suggested one size smaller than a PEX branch with the same flow and nearly the same
bore.

**Recommendation.** Sign copper, steel and PEX as is. For CPVC, the tester chooses the basis; if
the choice is the tolerance-allowing bore, the values become about 0.469 / 0.695 / 0.901 and the
larger sizes by the same rule. **Confidence: high** for copper and steel, **medium** for PEX (a
maker's figures, not the standard's), **medium** for the CPVC question.

**The tester decides.** The CPVC basis. Whether the body should say "Uponor's published bores" rather
than "the manufacturers' published averages", since other PEX makers print slightly different bores.

### 5. plumb.water.fixture-supply-min: minimum fixture supply sizes

**Values.** Bathtub 1/2 in; bidet 3/8; combination sink and tray 1/2; domestic dishwasher 1/2;
drinking fountain 3/8; hose bibb 1/2; kitchen sink 1/2; laundry 1 to 3 compartments 1/2; lavatory
3/8; shower single head 1/2; flushing-rim sink 3/4; service sink 1/2; urinal flush tank 1/2; urinal
flush valve 3/4; wall hydrant 1/2; water closet flush tank 3/8; water closet flush valve 1; water
closet flushometer tank 3/8; water closet one piece 1/2. Source: "IPC 604.4, Table 604.4".

**Public text.** Every value matches the IPC 2021 table (Colorado copy on UpCodes, and a Maryland copy
for the footnote). **But the table is Table 604.5**, "Minimum sizes of fixture water supply pipes",
under 604.5 "Size of fixture supply". Table 604.4 is the maximum flow rates and consumption table
(the 1.28 gallon water closet, the 0.5 gpm public lavatory). ICC's 2018 search listing shows the same
604.5 number for 2018. The table carries a footnote the rule does not: in a parallel (manifold)
distribution system, where the distribution line is 50 feet or less of developed length and the
meter has at least 35 psi, a line from the manifold may be one nominal size smaller (the figure read
from the 2021 and 2024 copies). The same section says the fixture supply ends within 30 inches of the
point of connection to the fixture; the body's "past its stop" puts the 30 inches at the wrong end.

**water-model.js agrees.** The values yes (`FIXTURE_SUPPLY_MIN_IN`); its comment repeats the wrong
table number (`IPC Table 604.4`), as does WATER-PLAN.md section 2.

**The drafter's doubt.** None written.

**Recommendation.** Change the section citation to "604.5, Table 604.5" in the rule, the water-model.js
comment and WATER-PLAN.md, in one commit; fix the 30-inch sentence. Values sign as is.
**Confidence: high.**

**The tester decides.** Whether the manifold footnote matters for the Bid Check row (a home-run PEX
manifold job would see 3/8 in lines flagged under 1/2 in fixtures that the code allows). That is a
product call: note it in the body, or teach the row the footnote.

### 6. plumb.water.distribution-min: the 3/4 in water service

**Values.** Water service pipe, at least 3/4 in. Source IPC 603.1.

**Public text.** IPC 2021 603.1 (Colorado copy): the water service pipe shall be not less than 3/4
inch in diameter. Matches.

**water-model.js agrees.** Yes, `WATER_SERVICE_MIN_IN = 0.75`.

**The drafter's doubt.** None written. WATER-PLAN.md section 2 still lists this rule's source as
"IPC 604.3 / 604.4"; the rule's 603.1 is the right one, the plan is stale.

**Recommendation.** Sign as is; correct the WATER-PLAN table row when the citation fix in entry 5
lands. **Confidence: high.**

**The tester decides.** Only the confirm.

---

## RULEBOOK-SIGN: the thirteen plumbing drafts

None of these is applied yet (`used_by: []`), so nothing in the app computes with them; what is at
stake is what the course cards teach.

### 7. plumb.waste.indirect: indirect waste for food equipment

**Values.** Food storage, preparation and handling equipment (a prep sink): air gap. A commercial
dishwashing machine: air gap or air break. An air gap above the receptor's flood rim: at least twice
the pipe opening. Source "802 Indirect wastes".

**Public text.** IPC 2021, Chapter 8 (Colorado copy): **802.1.1** Food handling, equipment and
fixtures for storage, preparation and handling of food discharge indirectly through an air gap;
**802.1.6** Commercial dishwashing machines, an air gap or an air break into a waste receptor;
**802.3.1** Air gap, not less than twice the effective opening of the indirect waste pipe; 802.3.2
Air break. Also **802.1.2**, floor drains in walk-in coolers and freezers, indirect by an air gap
(with an air-break exception), and **802.1.7**, sinks that wash, rinse or sanitize utensils, dishes,
pots and pans, in other than dwelling units, discharge indirectly through an air gap or an air break.
No Colorado amendment markings showed in 802.1. I could not confirm the 2018 numbering (from memory,
the air gap and air break sat under 802.2 in 2018 before moving to 802.3).

**The drafter's doubt.** That the sub-sections are numbered differently by edition (true; see
above), and that the card says an air gap for the dishwasher where the IPC allows an air break. The
card's air gap is always acceptable, so it teaches a safe answer, not a wrong one.

**Recommendation.** Sign the values. Change the citation to "802.1.1, 802.1.6 and 802.3.1 (2021
numbering)". **Confidence: high** on values, **medium** on the 2018 numbers.

**The tester decides.** Whether 802.1.7 matters to the course: read literally in the Colorado copy,
the restaurant's three-compartment pot sink also discharges indirectly (air gap or air break), which
is a floor sink the plan may not draw. I remember a model-code version that also allowed a direct
connection; the tester reads the adopted book and says whether the course's pot sink needs a line.

### 8. plumb.trap.seal: trap seal depth and protection

**Values.** Trap seal at least 2 in, at most 4 in. An emergency floor drain, or a trap subject to
evaporation: seal protection (a trap primer or a barrier device). Source 1002.4, 1002.4.1.

**Public text.** IPC 2021 (Colorado copy): **1002.4**, a liquid seal of not less than 2 inches and not
more than 4 inches; **1002.4.1**, the seals of emergency floor drain traps and trap seals subject to
evaporation are protected by one of the listed methods: a potable-water trap seal primer valve
(1002.4.1.1), a reclaimed or gray water primer (1002.4.1.2), a waste-water primer (1002.4.1.3), a
barrier-type device (1002.4.1.4), and in the Colorado copy a fifth, a lavatory, hand sink or drinking
fountain drain tied into the floor drain (1002.4.1.5; I could not tell whether that one is model text
or Colorado's). The UPC 2018 (Nevada copy) sets the same 2 to 4 inches in **1005.1** and asks for a
primer on a floor drain subject to infrequent use in **1007.1**.

**The drafter's doubt.** The other methods besides a primer, and jurisdictions that want a primer on
every floor drain. Both are correct as written. The UPC section numbers the draft gives ("its Chapter
10") are right.

**Recommendation.** Sign as is. **Confidence: high.**

**The tester decides.** Only the confirm. The course's primers come from the keynote (FLOOR DRAIN W/
TRAP PRIMER, TYP.), not from the rule, so the count does not depend on the jurisdiction question.

### 9. plumb.drain.slope: slope of horizontal drainage pipe

**Values.** 2-1/2 in and smaller 1/4 in/ft; 3 to 6 in 1/8 in/ft; 8 in and larger 1/16 in/ft. Source
704.1, Table 704.1.

**Public text.** IPC 2021 Table 704.1 (Colorado copy): exactly those three rows. **But 704.1 itself
carries an exception the rule leaves out:** where the drainage piping is upstream of a grease
interceptor, the slope is not less than 1/4 inch per foot, and the table has a footnote pointing
there. The same sentence is in the Tennessee 2021 adoption and in the Department of Defense and other
2018 adoptions on UpCodes, so it is model text in both editions the rule claims, not a state
amendment.

**The drafter's doubt.** That the card's "1/8 for 3 inch and larger" is conservative above 6 inches
(true), and the UPC's 1/4 in/ft default (from memory: UPC 708.1 starts at 1/4 and allows 1/8 for
larger pipe with the AHJ's approval; not opened).

**Recommendation.** Add a fourth value row: upstream of a grease interceptor, any size, 1/4 in/ft
(IPC 704.1). **Confidence: high.**

**The tester decides.** Whether the Chapter 4 card needs a clause. The card measures the 29-foot
sanitary run under the restrooms (4 in SS) at 1/8 in/ft, which is right, but it says "1/8 per foot
(IPC 704.1 for 3 inch and larger)" in the chapter that also traces the 3 in grease waste to the
interceptor, and that line falls at 1/4. A reader who carries the card's figure to the grease line
under-digs the trench.

### 10. plumb.waste.grease-interceptor: grease interceptors

**Values.** Fixtures and equipment with grease-laden waste in a food preparation area: through a grease
interceptor. Water closets, urinals, lavatories and other fixtures without grease: kept out of it.
Source "1003.3 Grease interceptors".

**Public text.** IPC 2021 **1003.3.1** (Colorado copy) requires a grease interceptor or automatic grease
removal device for fixtures and equipment with grease-laden waste in food preparation areas
(restaurants, hotel kitchens, hospitals, school kitchens, bars, factory cafeterias, clubs), lists
pot sinks, prerinse sinks, kettles, wok stations, floor drains or sinks kettles drain into, hood wash
units and dishwashers without prerinse sinks, and then says interceptors **"shall receive waste only
from fixtures and equipment that allow fats, oils or grease to be discharged."** 1003.3.2 keeps food
waste disposers out of an interceptor (with a large gravity-interceptor exception). The UPC 2018
**1014.1** (Nevada copy) says in so many words that water closets, urinals and other fixtures
conveying human waste shall not drain into or through the interceptor.

**The drafter's doubt.** That under the IPC the restroom exclusion only "follows from" the interceptor
serving grease waste, the plain statement being the UPC's. Answer: the IPC says it plainly too, in the
last sentence of 1003.3.1 quoted above. The draft's UPC 1014.1 citation is right.

**Recommendation.** Change the citation to "1003.3.1" and rewrite the Verify paragraph's second
sentence to cite the IPC's own sentence. Values sign as is. **Confidence: high.**

**The tester decides.** Only the confirm.

### 11. plumb.drain.cleanouts: cleanouts on drainage piping

**Values.** Horizontal drain, building drain or building sewer: cleanouts at most 100 ft apart. A change
of horizontal direction greater than 45 degrees: a cleanout at the change. The junction of the building
drain and the building sewer: "a cleanout near it, inside or outside the wall". Source 708.1.

**Public text.** IPC 2021 (Colorado copy) and IPC 2018 (Department of Defense copy), 708.1 and its
sub-sections: **708.1.1** horizontal drains and building drains, at intervals of not more than 100
feet; **708.1.2** building sewers, 100 feet (8 inch and larger go to manholes); **708.1.3** the junction
of the building drain and the building sewer is served by a cleanout **at the junction or within 10
feet of developed length upstream of it**; **708.1.4** a change of horizontal direction greater than 45
degrees gets a cleanout, and within 40 feet of developed length the first one serves the rest. Neither
copy has a base-of-stack cleanout requirement; that was 708.3.4 in the 2015 and earlier editions
(from memory), and the reorganized 2018 section dropped it. Colorado's 708.1.3 adds a fitting-type
sentence that is not in the Department of Defense copy, so that part is an amendment.

**The drafter's doubt.** That the card's "upstream end of each drain line" is the UPC's rule, not the
IPC's (right: UPC 707.4, from memory, puts one at the upper terminal of each horizontal drain); that
some editions add the base of each stack (right for 2015 and earlier, not 2018 or 2021); the 40-foot
sharing clause (right, 708.1.4).

**Recommendation.** Change the third value to "at the junction, or within 10 ft of developed length
upstream of it" (708.1.3); "near it, inside or outside the wall" is the older wording. Cite the
sub-sections (708.1.1, 708.1.3, 708.1.4). The other two values sign as is. **Confidence: high** on the
2018 and 2021 text.

**The tester decides.** Only the confirm. The course's four cleanouts are where the engineer drew
them, and the P-601 riser note 4 (a cleanout at the base of each stack) is an engineer's note, which
a set may ask for whatever the code minimum.

### 12. plumb.vent.trap-protection: venting protects every trap seal

**Values.** Each fixture trap: protected by a vent. Pressure difference at a trap seal: at most 1 in
w.c. Source 901.2.

**Public text.** IPC 2021 **901.2** (Colorado copy): a trap seal is not subjected to a pressure
differential of more than 1 inch of water column. Matches. The UPC's 901.2 states the same figure (from
memory, not opened).

**The drafter's doubt.** The ways to vent and the AHJ's view of air admittance valves; both correctly
left to the rest of Chapter 9 and the jurisdiction.

**Recommendation.** Sign as is. **Confidence: high.**

**The tester decides.** Only the confirm.

### 13. plumb.trap.arm-length: trap arms (the citation the row named)

**Values.** 1-1/4 in trap at 1/4 in/ft, at most 5 ft; 1-1/2 in at 1/4, 6 ft; 2 in at 1/4, 8 ft; 3 in
at 1/8, 12 ft; 4 in at 1/8, 16 ft. Source "909.1, Table 909.1 (the course and its riser note cite it
as Table 1002.2)".

**Public text.** IPC 2021 **Table 909.1**, maximum distance of fixture trap from vent (Colorado copy):
exactly those five rows. The UPC 2018 **Table 1002.2**, horizontal lengths of trap arms (Nevada copy,
read as text): 1-1/4 in 30 inches, 1-1/2 in 42 inches (3 ft 6 in), 2 in 60 inches, 3 in 72 inches,
4 in 120 inches, at 1/4 in/ft, with a separate 6-foot limit for a water closet's arm. So the rule's
numbers are the IPC's, and "Table 1002.2" is the UPC's table with shorter figures. From memory, not
opened: the IPC table was 906.1 before the 2018 edition.

**Where the wrong number sits.** Three places, none of them the rule:

- features/course-plumbing.js, Chapter 5 "Trace the stack": "IPC Table 1002.2 allows six feet for a
  1-1/2" arm".
- features/course-plumbing.js, Chapter 9 "What the rows mean", the reveal: "The riser dimensions the
  trap arms against Table 1002.2."
- scripts/sample-plan-candidates.js, the P-601 riser's note 2, "TRAP ARM LENGTHS PER IPC TABLE
  1002.2: 1-1/2" 6'-0" MAX, 2" 8'-0", 4" 16'-0"." (built into samples/sample-lessons.pdf by
  `npm run build:sample-lessons`).

**The drafter's doubt.** Exactly this, and the answer is the drafter's own: the six feet the card
teaches is the IPC's figure, and the IPC table is 909.1.

**Recommendation.** Sign the rule's values. Change "Table 1002.2" to "Table 909.1" on both cards and on
the riser note, in one commit that regenerates the lesson set (AGENTS.md: a sheet and its lesson
change together; lessons.spec.js walks every lesson), then drop the parenthetical from the rule's
`source.section`. **Confidence: high.**

**The tester decides.** Only that the course means the IPC. If it meant the UPC, the numbers change
instead (3 ft 6 in for the lavatory's 1-1/2 in arm, and the four-foot arm on the riser would fail).

### 14. plumb.vent.terminal: vent terminals (the local height the row named)

**Values.** Above the roof, as the course teaches it, 1 ft (the value row itself says the IPC leaves
the height to the jurisdiction). Above a roof used for assembly, a promenade or a deck, 7 ft.
Horizontally from a door, openable window or air intake, at least 10 ft; closer than that, 3 ft above
the top of the opening. Source "903 Vent terminals (903.1 roof extension, 903.5 location)".

**Public text.**

- **The height is a blank in the model code.** The Maryland 2024 copy on UpCodes prints the roof
  extension height as a bracketed [NUMBER] for the adopting jurisdiction; the 2021 search listings
  show the same blank. Adopted figures found: Colorado 6 inches, Douglas County (Colorado) 12 inches,
  New York City 24 inches (the last two from search results, not opened).
- **The 2021 edition split 903.1** (Colorado 2021 and Maryland 2024 copies): 903.1 Vent terminal
  required, **903.1.1** roof extension unprotected (the blank), **903.1.2** roofs used for recreation or
  assembly (7 feet), 903.1.3 protected vent terminal (a terminal under a roof element, at a small
  height above the roof surface; the two copies differ, so one of them is amended), 903.1.4 sidewall
  terminal. In 2018 the roof extension and the 7 feet were both 903.1 (from memory).
- **903.5 Location** (Colorado 2021): not directly beneath a door, openable window or air intake, and
  not within 10 feet horizontally of one unless 3 feet or more above its top. Matches the rule.
- The UPC sets 6 inches above the roof with the same 10 ft / 3 ft clearances (906, from memory, not
  opened).

**The drafter's doubt.** That the foot above the roof is a local figure, not the model code's. Right:
the model code has no number there. The riser's note 3 ("VENT TERMINAL 12" MIN. ABOVE THE ROOF") is an
engineer's note on a sample sheet, which is a fair place for a local figure.

**Recommendation.** Keep the 7 ft and the 10 ft / 3 ft rows. Cite "903.1.1 and 903.1.2 (903.1 in
2018), 903.5". The 1 ft row needs a decision (below). **Confidence: high** on the clearances and the
blank, **medium** on the 2018 numbering.

**The tester decides.** How a rule holds a figure the code leaves to the jurisdiction. Two honest
options: keep the row with `when` saying it is the course's (and the riser note's) figure, as now, and
add an `amendments` entry for a jurisdiction that sets another; or make the row "the adopting
jurisdiction's figure" with no number, and let the card say "a foot, on this job's riser". Either way
the card's "a foot above the roof" should read as this job's number, not the IPC's.

### 15. plumb.gas.pipe-sizing: gas pipe sizing

**Values.** A section of gas pipe is sized by the connected load downstream of it, over the length from
the meter to the most remote outlet (the longest length method). Source IFGC 402 (402.4, 402.4.1).

**Public text.** IFGC 2018 as Seattle adopted it (text PDF): **402.4** says the pipe length for the
tables is found by 402.4.1, 402.4.2 or 402.4.3; **402.4.1** Longest length method sizes each section
with the longest length from the point of delivery to the most remote outlet and the load of that
section; **402.4.2** Branch length method; the hybrid pressure method is 402.4.3. The 2021 Colorado
fuel gas chapter on UpCodes shows the same three-way reference in 402.4 (the sub-sections did not
come through).

**The drafter's doubt.** That the table depends on the gas, material, pressure and allowed drop (all
the engineer's), the heating value from the supplier, and the other two methods. All correct.

**Recommendation.** Sign as is. Note that the code measures from "the point of delivery", which is
the meter on the course's job but is the outlet of the service regulator or meter in general.
**Confidence: high.**

**The tester decides.** Only the confirm.

### 16. plumb.gas.appliance-shutoff: appliance shutoff valves

**Values.** Each gas appliance: its own shutoff valve. From the appliance, in the same room, at most
6 ft. Source IFGC 409.5, 409.5.1.

**Public text.** IFGC 2018 (Seattle text PDF): **409.5**, each appliance gets a shutoff valve per
409.5.1, 409.5.2 or 409.5.3; **409.5.1** Located within same room, in the same room, within 6 feet of
the appliance, upstream of the union, connector or quick disconnect it serves, with access, and a valve
behind a movable cooking appliance counts as having access; **409.5.2** vented decorative appliances
and room heaters may have a remote valve; **409.5.3** a valve at a manifold may be within 50 feet. The
IRC 2024 mirror (G2420.5.1) reads the same.

**The drafter's doubt.** Other locations for some appliances (right: 409.5.2 and 409.5.3), and the
hood valve being its own rule (right).

**Recommendation.** Sign as is. **Confidence: high.**

**The tester decides.** Only the confirm. One trade note for the card: a valve behind a range or
fryer is accepted as accessible (409.5.1), which is where the course's four drops put them.

### 17. plumb.gas.hood-shutoff: the hood suppression shutoff

**Values.** The hood suppression system discharges: gas to the appliances under the hood shuts off
automatically. After a discharge: manual reset. Source NFPA 96, 10.4. `kind: standard`.

**Public text.** NFPA 96 did not open. What did: **NFPA 1 (2021) 50.5.3**, "Fuel and Electric Power
Shutoff", on UpCodes, which is NFPA 96's 10.4 carried into the fire code: on actuation, every source of
fuel and electric power that produces heat to the protected equipment shuts off automatically; gas
appliances under the same ventilation equipment shut off too even if they need no protection; the
shutoff needs a manual reset, and an electric gas valve is restored through a manually reset relay.
Search results quoting NFPA 96 give the same points as 10.4.1, 10.4.3 and 10.4.4. The ICC side says it
too: the International Fire Code's commercial cooking section has a "System interconnection" clause
requiring the automatic shutdown and a manual reset (904.13.2 in the 2021 IFC per a search listing,
904.12.2 in 2015; I could not open either).

**The drafter's doubt.** That the numbers under 10.4 move by edition (they may; the 2021 NFPA 1 extract
is the only text I saw), and who furnishes the valve (a contract question, correctly left to the
sheets).

**Recommendation.** Sign the values; they match every text I could reach. Consider citing the IFC
section as well, since an AHJ enforcing the I-codes reads the IFC before NFPA 96. **Confidence:
medium**: the substance is certain, the 10.4 sub-numbers are from search snippets and an extract, not
the standard.

**The tester decides.** Only the confirm, against NFPA 96 in the edition the fire marshal enforces.

### 18. plumb.hanger.steel: steel pipe hangers (the fuel gas question the row named)

**Values.** Steel pipe, horizontal 12 ft, vertical 15 ft. Source IPC 308.5, Table 308.5.

**Public text.**

- **IPC 2021 Table 308.5** (Colorado copy): steel pipe 12 ft horizontal, 15 ft vertical. The rule is
  right for the pipe the IPC governs (steel water and drainage pipe).
- **IFGC Table 415.1**, Support of piping (IFGC 2018, Seattle text PDF; the IRC 2024 G2424.1 mirror
  reads the same): steel pipe 1/2 in every 6 ft; 3/4 or 1 in every 8 ft; 1-1/4 in and larger,
  horizontal, every 10 ft; 1-1/4 in and larger, vertical, every floor level. CSST follows the maker's
  instructions.
- **Which code governs gas pipe.** The IPC's scope hands fuel gas piping to the International Fuel
  Gas Code (IPC 101.2, from memory and a search result; the Colorado copy omits Chapter 1). So on a
  gas line Table 308.5 does not apply at all.

**Where the card stands.** features/course-plumbing.js, Chapter 6 "A hanger row of your own", on the
1.25in BI gas line: "IPC Table 308.5 hangs steel pipe every 12 ft", and its action writes
`Hanger · 1 per 12 ft`. Under IFGC 415.1 a 1-1/4 in black steel gas line hangs every **10 ft**. The
card undercounts the gas line's hangers by about a sixth and cites the wrong code for it.

**The drafter's doubt.** Exactly this, with the right IFGC figures. Confirmed.

**Recommendation.** Two changes, both the tester's to approve:

1. This rule keeps its values and its IPC citation, and its summary says it is steel pipe under the
   plumbing code (water and drainage), not gas. It signs as is on that scope.
2. A new draft gas rule carries IFGC Table 415.1 (the four steel rows, and the tubing rows if the
   course wants them), the gas card names it instead of `plumb.hanger.steel`, and the card's figure
   and action become 1 per 10 ft. The hanger-spacing family (copper, PEX, PVC, cast iron) are applied
   rules with a `code:` pointer, so if the steel or gas row is ever offered automatically on a line
   type, its number enters the drift check like theirs.

**Confidence: high** on the figures and on which code governs; the course change is a product call.

**The tester decides.** That the gas card teaches the fuel gas figure (10 ft), and whether that is a
new rule or this one re-scoped to gas (it cannot be both 12 and 10 ft).

### 19. plumb.drain.dfu-capacity: building drain and sewer capacity

**Values.** 3 in building drain or sewer: 36 DFU at 1/8 in/ft, 42 at 1/4, 50 at 1/2. 4 in: 180 at
1/8, 216 at 1/4, 250 at 1/2. Source 710.1, Table 710.1(1).

**Public text.** IPC 2021 Table 710.1(1) (Colorado copy): exactly those six figures, with the 1/16
column blank for both sizes and a footnote that a building drain serving a water closet is at least 3
inches. Per-fixture drainage units are Table 709.1, as the body says.

**The drafter's doubt.** Only the 3 and 4 in rows are here (a scope choice, fine); the UPC's
different tables (correct, not checked).

**Recommendation.** Sign as is. **Confidence: high.**

**The tester decides.** Only the confirm. The course's 47 DFU on a 4 in sewer at 1/8 in/ft is well
inside 180.

---

## For the tester

**The ones you only confirm** (open the book, check the figure, sign). Where a citation or a wording
change is proposed, it is mechanical once you agree:

1. **plumb.wsfu.fixtures**: IPC Table E103.3(2), all 27 rows matched the 2021 text. Check the 2018
   book too.
2. **plumb.wsfu.demand**: Table E103.3(3), all 100 points matched. Say whether the book tells you to
   interpolate; if not, the body's sentence becomes the app's.
3. **plumb.water.fixture-supply-min**: values right; the table is **604.5, not 604.4**. Fix the rule,
   the water-model.js comment and WATER-PLAN.md together.
4. **plumb.water.distribution-min**: 603.1, 3/4 in. Right.
5. **plumb.waste.indirect**: values right; cite 802.1.1, 802.1.6, 802.3.1.
6. **plumb.trap.seal**: 1002.4 and 1002.4.1, right.
7. **plumb.drain.slope**: add the row the rule is missing, **1/4 in/ft upstream of a grease
   interceptor** (704.1, in 2018 and 2021).
8. **plumb.waste.grease-interceptor**: cite 1003.3.1; the IPC does say the interceptor takes only
   grease-bearing waste, in its own words.
9. **plumb.drain.cleanouts**: the junction cleanout is **at the junction or within 10 ft upstream**
   (708.1.3), not "near it, inside or outside the wall".
10. **plumb.vent.trap-protection**: 901.2, 1 in w.c. Right.
11. **plumb.trap.arm-length**: values are the IPC's (Table 909.1). The two cards and the P-601 riser
    note say "Table 1002.2", the UPC's table: change them to 909.1 and regenerate the lesson set.
12. **plumb.gas.pipe-sizing**: IFGC 402.4 / 402.4.1. Right.
13. **plumb.gas.appliance-shutoff**: IFGC 409.5.1, same room, within 6 ft. Right.
14. **plumb.gas.hood-shutoff**: right in substance; check the 10.4 sub-numbers in the NFPA 96 edition
    your fire marshal enforces (I could not open NFPA 96).
15. **plumb.drain.dfu-capacity**: Table 710.1(1), all six figures. Right.

**The ones that need your judgment:**

1. **plumb.hanger.steel on the gas line.** The gas card teaches 1 per 12 ft from IPC 308.5; the fuel
   gas code (IFGC Table 415.1) hangs 1-1/4 in steel gas pipe every **10 ft** and governs gas, not the
   IPC. Decide: a new gas-support rule and a 10 ft card, with this rule re-scoped to water and
   drainage steel (recommended).
2. **plumb.vent.terminal's foot above the roof.** The model code leaves the height blank for the
   jurisdiction (and since 2021 it is 903.1.1). Decide how the rule holds a local figure, and let the
   card say it is this job's number.
3. **plumb.water.velocity.** The values are right, but the body says no code prints a velocity limit
   and the **UPC does** (610.12, 8 / 5 fps for copper). Decide whether the rule names the UPC, and
   whether hot water above 140 °F wants a lower cap.
4. **plumb.water.pipe-id, CPVC.** Copper, steel and PEX are right. CPVC uses the largest possible
   bore while PEX allows for wall tolerance; at 1/2 in that is about 9 percent in velocity. Pick one
   basis.

**Side questions worth a minute** (no rule changes by themselves): whether the three-compartment pot
sink needs an indirect waste line under 802.1.7 as your jurisdiction adopted it; whether Bid Check's
fixture-supply row should know Table 604.5's manifold footnote (one size smaller on a short parallel
system); and whether the slope card in Chapter 4 should say the grease line falls at 1/4.

**No value found wrong in a rule file.** The wrong numbers are in citations (604.4 for 604.5; the
cards' and riser's 1002.2 for 909.1), in a missing row (the grease-interceptor slope), in one value's
wording (the cleanout at the junction), and on one card (12 ft on a gas line that the fuel gas code
hangs at 10).

## Settled 2026-09-27

Will delegated this dossier's questions to Claude ("a lot of these you can just decide"). Each entry
below was re-checked against the dossier's sources, the sibling course dossier
(TESTER-DOSSIER-PLUMBING-COURSE-2026-09-27.md, which opened the 2018 IPC and ICC's 2021 IFGC sample
pages) and the model code text as Claude knows it. Nobody opened a printed book: every rule signed
here says so in its Verify against your edition paragraph ("Settled 2026-09-27 by Claude on the
owner's delegation, from the dossier's research and the model code text; not checked against a
printed book or a local amendment."). The thirteen drafts keep `status: draft`, because the rulebook
defines `applied` as "an app surface uses it" and the loader refuses `applied` with an empty
`used_by`; the sign-off is the sentence in the file, not the status.

**WATER-TABLES**

- 1 `plumb.wsfu.fixtures`: signed as is; Verify paragraph added (2021 matched, 2018 not opened). APPLIED.
- 2 `plumb.wsfu.demand`: values signed; the interpolation sentence now says the app interpolates, not the code; the three app conventions confirmed as the app's. APPLIED.
- 3 `plumb.water.velocity` (judgment): stays `convention` with the ASPE / CDA source; the body and summary now say the IPC prints no limit and the UPC caps copper at the same 8 / 5 (610.12, 2021); no lower default hot cap, the body tells the estimator to lower the schedule's hot cap on a loop above 140 °F (2 to 3 fps). APPLIED.
- 4 `plumb.water.pipe-id` (judgment): copper Type L, Schedule 40 steel and PEX signed; the body now says "Uponor's published AquaPEX bores". CPVC basis decided as the tolerance-allowing bore (the one that never suggests too small a pipe), but NOT applied: a maker's bores for 1-1/4 to 2 in are in no source read and the 1/2 to 1 in figures came from a search snippet, so the values would be invented. LEFT OPEN (needs a CPVC maker's published inside-diameter table, 1/2 to 2 in).
- 5 `plumb.water.fixture-supply-min`: citation 604.4 → 604.5, Table 604.5 in the rule, water-model.js, WATER-PLAN.md, the two water feature comments and the ARCHITECTURE.md row; the 30-inch sentence fixed (the supply ends within 30 in of the fixture). APPLIED.
- 6 `plumb.water.distribution-min`: signed; WATER-PLAN's stale "604.3 / 604.4" row now reads 603.1. APPLIED.
- Side question, the Table 604.5 manifold footnote: noted in the rule's body; Bid Check and the schedule keep flagging (over-warning, never under-sizing), and the estimator leaves a home-run line as drawn. APPLIED for the decision. The footnote's two limits are LEFT OPEN: the dossier read 50 ft and 35 psi, Claude's memory of the text is 60 ft and 40 psi, so the body states neither.

**RULEBOOK-SIGN (plumbing)**

- 7 `plumb.waste.indirect`: signed; cites 802.1.1, 802.1.6, 802.1.7 and 802.3.1 (2021 numbering). APPLIED.
- Side question, the pot sink under 802.1.7: a fourth value row added (a utensil, dish, pot and pan sink other than in a dwelling unit: air gap or air break). APPLIED on the rule. Whether the course's three-compartment sink needs its own indirect line is a card and sheet question for the course dossier. LEFT OPEN (not this dossier's files).
- 8 `plumb.trap.seal`: signed as is (UPC 1005.1 / 1007.1 named for 2018). APPLIED.
- 9 `plumb.drain.slope`: fourth row added, 1/4 in/ft upstream of a grease interceptor at any size (704.1, 2018 and 2021); body and summary say so. APPLIED.
- Side question, the Chapter 4 slope card: yes, the card should say the grease line falls at 1/4. The card is the course dossier's (PC-REVIEW-1); not edited here. LEFT OPEN (course agent's).
- 10 `plumb.waste.grease-interceptor`: cites 1003.3.1; the Verify paragraph now quotes the IPC's own "waste only from fixtures that allow fats, oils or grease" sentence and names 1003.3.2 for disposers. APPLIED.
- 11 `plumb.drain.cleanouts`: junction value now "at the junction, or within 10 ft of developed length upstream of it" (708.1.3); sub-sections cited; base-of-stack noted as pre-2018 and the riser's note 4 as the engineer's. APPLIED.
- 12 `plumb.vent.trap-protection`: signed as is. APPLIED.
- 13 `plumb.trap.arm-length`: signed; the parenthetical dropped from `source.section`; both course cards (`riser:stack`, `bidcheck:rows`) and P-601 riser note 2 now say Table 909.1; samples/sample-lessons.pdf regenerated. APPLIED.
- 14 `plumb.vent.terminal` (judgment): the height row is now "the adopting jurisdiction's figure" with no number (903.1.1, a blank in the model code), with Colorado's adopted 6 in as an `amendments` entry; citation 903.1.1 / 903.1.2 (903.1 in 2018), 903.5. The course card's reveal now says a foot above the roof is this job's number, from riser note 3. APPLIED.
- 15 `plumb.gas.pipe-sizing`: signed; the length value and the Verify paragraph say "point of delivery" (the meter on the course's job). APPLIED.
- 16 `plumb.gas.appliance-shutoff`: signed; 409.5.1's valve-behind-a-movable-appliance access and 409.5.2 / 409.5.3 named. APPLIED.
- 17 `plumb.gas.hood-shutoff`: substance signed (automatic shutoff of every gas appliance under the hood, manual reset), from NFPA 1 (2021) 50.5.3's extract of NFPA 96. APPLIED for the substance. The sub-section numbers under NFPA 96 10.4 are LEFT OPEN: NFPA 96 was not opened, the numbers came from search snippets.
- 18 `plumb.hanger.steel` (judgment): re-scoped to steel water and drainage pipe (IPC Table 308.5, 12 ft / 15 ft), signed on that scope. New draft rule `plumb.hanger.gas-steel` (IFGC Table 415.1: 1/2 in 6 ft, 3/4 or 1 in 8 ft, 1-1/4 in and larger 10 ft horizontal and every floor vertical, CSST per the maker), signed. The gas card (`gas:hangers`) names the new rule, cites IFGC Table 415.1 and teaches 1 per 10 ft; its action writes `ftInterval: 10`; course-plumbing.spec.js pins 10. SupportModel and Bid Check never read `plumb.hanger.steel` (no steel material row), so no app data changed. APPLIED.
- 19 `plumb.drain.dfu-capacity`: signed as is. APPLIED.

**Not trade: for an agent.** This dossier has no such section (the course dossier's is the course
agent's). Nothing to do.

Counts: 22 entries (15 confirm, 4 judgment, 3 side questions). APPLIED 17 in full, 2 applied with
a part left open (the hood's 10.4 sub-numbers; the manifold footnote's limits), LEFT OPEN 1 (the
CPVC bores), and 2 side questions decided here but left open for the course dossier's files (the
pot sink's line, whose rule row did land; the slope card). ALREADY DONE: none (the rule's own 909.1 was already right; the cards and the note were not).

---
title: Duct takeoff by the pound
description: Trace duct runs with size step-downs, let fittings count themselves, and read one Bid weight off the Duct Schedule — sheet metal priced like a bid.
updated: 2026-09-13
order: 9.15
icon: duct
category: By trade
---

Sheet-metal bids come down to one number: **pounds of duct**. Most takeoff tools stop at linear feet and leave the gauge tables, fitting allowances, and waste factors to a spreadsheet. CountTooling carries the trace all the way to a **Bid weight** — straight duct by size, fittings counted off the geometry, insulation square footage, and seam & waste on their own labeled lines.

## Trace a run

[Set the page scale](/guides/setting-the-scale/) first, then pick the **Duct** tool [[duct]] in the header. The create dialog asks only for what a run starts as:

- **Airside** — Supply, Return, or Exhaust. It's a property of the run: supply traces in blue, return in red, exhaust in green, and the Duct sidebar groups by it.
- **Starting size** — a rectangle (`24×12`) or a round diameter (`12"Ø`).
- **Pressure class** — picks the gauge automatically from the SMACNA-style schedule (the larger side sets the gauge; a 24×12 at 1" w.g. comes out 24 ga).
- **Insulation** — liner or wrap, if the run carries it.

Then click along the main, corner by corner, exactly like a polyline. The stroke width steps with the duct size, so a 24×12 trunk reads bolder than an 8"Ø branch at a glance.

## Step sizes with S

Press **`U`** to arm the Duct tool from the keyboard (the button's tooltip and the Keyboard Map say so; `D` stayed with Measure). Real trunks step down as air leaves them. Mid-trace, press **`S`** (or tap the size chip riding the cursor) to open the step popover: one-tap common step-downs from the current size, or type a custom W×H or Ø. The current segment ends at the last corner you placed and the next one starts at the new size — one continuous run, sized like the shop will build it.

`Enter`, a double-click, or the **Finish Duct Run** bar commits the run. `Esc` steps backward first — it closes the popover, then removes the last corner, then abandons the trace.

## Plan-and-spec: read the sizes off the sheet

When an engineered mechanical sheet arrives, the sizes are already printed beside every run — and a real PDF (not a scan) carries those callouts in its text layer with coordinates. The Duct tool reads them so you don't retype them:

- **Starting size from the plan.** Point at the trunk you're about to trace and press Duct: if a size callout sits within about 60 points of the cursor (`24x12`, `24×12`, `24"x12"`, `24/12`, `12"Ø`, `12" DIA`, `Ø12` — any of the usual spellings), the create dialog opens pre-filled from it and says so: *"from the plan: 24×12."* Change it if the sheet says otherwise; with no callout nearby the fields are simply left as they were.
- **Step-downs as you pass them.** While you trace, a callout of a *different* size near the cursor puts a quiet line under the size chip — *"Plan says 20×12 here — S accepts"* — and rings the text it read. Press `S` and that size is the first chip in the popover; one tap steps the run down (and the transition counts itself, as always). Nothing is ever applied on its own.

Where a plan callout and a design-build suggestion (below) are both available at the cursor, the printed size wins the line — the engineer's number outranks a rule of thumb — and the popover shows both, plan first. There is no mode to switch: a scanned sheet has no text layer, reads nothing, and the tool behaves exactly as it does on a design-build job. Dates, dimensions like 24'-0", scale ratios and pipe sizes never read as duct.

## Design-build: the plan sizes itself

Most duct jobs are **design-build** — there's no engineered duct to copy, just an architectural background and a load. CountTooling turns the takeoff into the design pass:

1. **Give your air devices a CFM.** The counter Create tab, the Quick tab and each counter's settings carry an optional **CFM** field — 150 on the lay-in diffuser, 300 on the big register. Leave it empty on anything that isn't an air device; nothing changes for those. The moment you type a CFM, a chip appears beside the field — *→ Supply Diffuser · change* — naming the symbol the counter will take (the HVAC set's diffuser unless you pick another); **change** opens the Custom Icons grid at the HVAC group, where every cell names itself on hover (RTU, return grille, VAV box, fire/smoke damper). When one placed diffuser is sized differently from its type — the 250 in the corner office — right-click that mark and pick **CFM for this one…**: the number belongs to that mark alone, the counter's CFM stays as it was, and everything downstream (the suggestion, the room's served total, the system's designed air) reads the override. Clear the box to go back to the type's CFM; the counter's settings list any marks that carry their own.
2. **Place the diffusers first**, straight off the reflected ceiling plan.
3. **Trace the main.** While you trace, the size chip grows a second line: *"450 CFM downstream · suggests 12×10 @ 0.08″/100′ — S accepts."* Every device the trace passes hands off its air, and the suggestion shrinks with the remaining CFM — the classic ductulator answer (equal friction, 0.08″/100 ft by default) computed live at the cursor.
4. **Accept with a tap.** Press `S`: the suggestion sits at the top of the step popover as two chips — spiral first, then the rectangular equivalent (*"10"Ø or 12×8"*, the way a master sizes it); one tap on either steps the run down to that size. Suggestions only ever *inform* — the size never changes unless you take it.

### The true-width ghost

Under every run's stroke sits a quiet translucent band in the airside color at the duct's **real width on the sheet** — a 24×12 trunk on a ¼"-scale plan paints a 24"-wide footprint, steps to 20" where the run steps down, and a 10"Ø branch paints 10". It's there while you trace and after you commit, on the live canvas and on every exported page, and it turns with the sheet. Rectangular duct shows its width in plan (the smaller side when the run is flagged **On edge**); round duct shows its diameter. Pages with no scale paint nothing extra (there's nothing to convert), and so does a deep zoom-out where the band would be thinner than the stroke. That's what makes the markup the submittable layout: the coordination question — *does the 48" main clear the beam pocket, do two mains fit side by side over the corridor* — answers itself on the drawing. **Legend Settings → Show duct true width** turns the band off when you'd rather see bare linework; the size chips and the stroke stay.

Devices belong to a run when the trace (or a branch's tap) lands within snap distance of them, and to a **system** through that run's group — so with two RTUs on the sheet, each system accumulates only its own air. When the **velocity cap** governs instead of friction (default 1,200 fpm), the suggestion says so: *"velocity-limited."* Both knobs — friction rate and max velocity — live at the bottom of the Duct Schedule and stick with the project.

### Room targets and the air balance

Where do the CFMs come from before any device is placed? From the rooms. [Room Sizer](/guides/hvac-takeoff/) boxes already know each room's floor area — give the room a **type** on its edit dialog (Office 1.0 CFM/ft², Conference and Break 1.5, Storage 0.5, or Custom) and it gets a **target CFM** of area × rate, with a per-room CFM override that always wins. Rooms without a type change nothing.

Once a room has a target, its sidebar row keeps score: *"needs 450 · served 300 ⚠"* — served is the CFM of the devices actually sitting inside the room's boxes, and the ⚠ only appears when the room is short by more than about 10%. Drop in the missing diffuser and the flag clears. The on-canvas legend keeps the same score per sheet: an under-served room adds one line — *"⚠ Office 101 needs 450 · served 300"* — under that sheet's room rows, on the live canvas and on every exported page, and it disappears the moment the room is served (it rides the **Show duct rows** legend setting; rooms without a type add nothing). System groups get the same treatment one level up: a group with a unit capacity shows *"600 designed / 600 capacity ✓"* on its header — designed is the device air its duct actually carries — and flips to ⚠ the moment the trees out-draw the unit.

And before any duct is traced at all, the New Duct Run dialog reads the room targets and offers the **equipment-first** rule of thumb: *"Rooms total ~2,400 CFM — about 2 systems at 1,200 CFM (edit in Groups)"* (~400 CFM per ton, ~5 tons per light-commercial rooftop unit). It's one quiet line, it never creates anything, and it disappears as soon as a system group carries a real capacity. Naming an equipment counter after a group's tag (place an "RTU-1" counter for the RTU-1 system) also anchors the system's unit on the sheet, so return mains accumulate correctly no matter which end you traced them from.

Systems live in the **Groups** section of the sidebar, which a project keeps off until it needs it. You never have to go find the switch: wherever a duct surface names Groups while they're off — that equipment-first line, the Bid Check's *Systems within capacity* hint — the phrase is a **Turn on groups** link that flips them on in place, and the first duct run you commit turns them on by itself with one quiet note (*"Groups are on — assign this run to a system in Groups."*). Projects with no duct never see any of this.

### Vertical footage, flex, and necks

A flat trace can't see the riser off the rooftop unit or the drop down a chase, so the `S` popover carries a **Rise / drop** row: type the feet and tap Add, and that vertical footage joins the run at the size of the segment it sits on — in the schedule, the legend, and the live readout, priced like any other straight duct. Each rise/drop is a mark on the sheet too: a small blue triangle with its feet (*12'*) just above the vertex, on the plan and on every export, and it behaves like a fitting — right-click it for **Edit rise/drop…** (the number, in place) or **Remove**. Two defaults absorb the common cases:

- **Deck height** (per project — on the New Duct Run dialog beside the pressure class, on the Room Size dialog of an HVAC project, and at the bottom of the Duct Schedule; one setting, three doors) — once it's set, a run that *starts* on its system's equipment marker gets the riser added automatically (deck height less the ceiling of the room box it starts in, when one is drawn; the full deck height otherwise). Set it before the first trace and the main off the unit gets its riser on the first click; set or change it later and every run that already starts at its unit is brought up to date (a riser you typed yourself at that vertex is left alone). Open the popover right after that first click to see it — and to remove it if the unit sits on grade.
- **Flex drop** — every CFM counter carries a per-drop flex length (5' unless you set one on the Create tab or the counter's settings). Devices that hang off a run feed a per-system **Flex duct** line on the schedule: *"RTU-1 · 5 drops · 40'"*. Flex is priced by the drop, so this line is linear feet only and never touches the bid weight. When any single drop runs past the **Max flex** cap (6' by default, editable beside deck height), the row says so — *"3 drops over 6' max"* — because that's exactly the drop a master flags on the walkthrough.

One more prefill: a CFM counter whose name doesn't already say a size shows the neck-size rule of thumb as its hover title and in its settings — *"150 CFM → 8"Ø neck"* — so the exported layout reads like a submittal.

## Fittings count themselves

You never click "add elbow." The geometry already says where the fittings are, so the app counts them from the trace:

- a **corner** is an elbow (a shallow bend logs a 45°, a square one a 90°), sized to the duct being bent;
- a **size step** is a transition, sized to the larger end;
- a **run started on another run** is a tap on the parent, sized to the branch collar.

Every inferred fitting is a marker on the sheet. Right-click one to **reclassify** it (45°, boot, offset…) or delete it — your call always outranks the geometry, and re-tracing never resurrects a fitting you removed. It's the same philosophy as the automatic gauge pick: the app does the routine call, you keep the override.

Taps carry one more default: a **volume damper**. With *VD per tap* on (the toggle at the bottom of the schedule, on by default), every tap adds a Volume damper row to the fittings section at the tap's size. Right-click a tap for **Remove volume damper** where the branch runs undampered — that call sticks through re-tracing too — and **Add volume damper** puts it back. Fire dampers stay manual counters: the app can't know where the rated walls are.

## The Duct Schedule

Click **Schedule** on the Duct section of the sidebar. The schedule prices like a bid:

- **Straight duct by size** — size, gauge, LF, lb/ft, pounds. Round rows also show the **joint count** (spiral lands in 10' sticks), because spiral is catalog-priced by LF as often as by weight.
- **Fittings** — the counted rows (each type and size at its equivalent-weight each, volume dampers included), or flip the toggle to **Factor %** and apply one percentage of straight pounds for a quick bid. The default is 40%; both the mode and the percentage stick with the project.
- **Flex duct** — per-system drops and linear feet, with the over-max warning. Priced by the drop, so it stays out of the pounds.
- **Insulation** — liner and wrap square feet, derived from the same footage × perimeter.
- **Seam & waste** — its own labeled line, +15% by default and editable, never buried in a unit price.
- **Bid weight** — the one number that goes on the bid.

On a multi-sheet set the schedule header offers **This sheet / Every sheet**, the same scope language as every export.

**Copy Schedule** puts the whole table on the clipboard as tab-separated text — it pastes into a spreadsheet in columns, into an email legibly, and into PipeTooling alongside your [counts and line types](/guides/reports-and-exports/). One toast confirms it — the Bid weight, the paste hint, and any Bid Check row still open. Copying runs the same scale check as the other copies: if a sheet with duct on it has no scale, you're told before pixel-length garbage reaches a bid. The pounds also ride the two copies named for handoff: **Copy Summary** and **Copy to /Tooling** both end with a *--- Duct ---* block carrying the per-size LF · lb rows, the straight and fittings totals, and the Bid weight — the same rows, the same tab-separated columns — whenever the copied sheets hold duct.

**Multiply zones** multiply duct the way they multiply everything else: a run drawn inside a ×3 zone counts three times in the Duct section, the schedule, the legend and the report (its fittings too), a run that starts inside and ends outside counts once — the same rule a line follows — and the zone dialog says how many duct runs it found before you apply. Where the placed and with-repeats numbers differ, the schedule says both (*"107' · 741 lb placed · 187' · 1,296 lb with repeats"*) and the sidebar badge shows it on hover.

## Bid Check: sign off before you send it

Quantity, capacity, physics — and then the sign-off. Once a project has a duct run, the **Bid Check** section in the sidebar (the same panel every trade gets; the badge counts what is open) grows the duct rows. Four are **auto** — the app knows, so they show their number and can't be ticked: *Every room served* (the Room Sizer balance — which rooms are still short), *Systems within capacity* (designed vs the unit), *Flex drops within max*, and *Scale set on every duct sheet*. The rest are the judgment calls only a master can make, as checkboxes that persist with the bid: fire dampers at rated walls, OA meets code, curb & power coordinated, controls / stat locations set.

One row starts as a checkbox and **upgrades itself**: *Fits the roof — deepest duct + insulation clears the plenum.* Give the project a deck height (bottom of the Duct Schedule), draw the room box with its ceiling under the run, and the row becomes auto and shows its work — *"24×12 + 2" wrap = 14" · plenum 30" ✓"*, or the run that doesn't fit by name. A rectangular run hangs **flat** by default — the width sits in plan, so the second number is its depth. When a trunk is turned **on edge** to slip between joists, say so: right-click the run and pick *On edge* under **Orientation** (the sidebar row tags it *on edge*), and the row reads the larger side instead — *"Supply Main (on edge): 24×12 + 2" wrap = 26" · plenum 24" ⚠"*. Flat runs keep today's wording and today's saved shape. While you trace, the `S` popover carries the same arithmetic as a quiet line for the size under your cursor (*"14" deep · plenum 12" ⚠"*), with the same Flat / On edge toggle right under it so a run can be turned mid-trace — informative, never an interruption.

The second self-upgrading row is the master's "will it blow?": *Static path within unit ESP.* Give the system group its available external static — the **ESP** field beside the capacity in the group dialog, in inches w.g. from the unit's data — and once the system has a run the row becomes auto and shows the critical path: the longest path from the unit to a terminal in *equivalent* feet (the straight duct, rises and drops included, plus every elbow, transition and tap along it counted as the feet of straight duct it costs — the same rules of thumb printed on a ductulator), priced at the friction rate from the Duct Schedule, plus a terminal allowance for the diffuser and its flex (0.10" by default, on the Suggestions row). *"RTU-1: 0.34" of 0.80" ESP · critical path 187 eq ft (68' duct + 2 elbows + 1 transition @ 0.08"/100' + 0.10" terminal) ✓"* — and when the path is over the unit, the row names the leg that made it long and the size to upsize: *"RTU-2: 0.91" of 0.80" ESP — Branch 3 is the long leg; upsize its 8×6 or lower the friction rate ⚠"*. The same number rides the system's header in the Groups list (*"· 0.34" of 0.8" ESP"*). Clear the ESP and the row is a checkbox again.

The check surfaces once more at the moment that means "I'm done": **Copy to /Tooling** and **Export PDFs** carry a small badge (*"1 ⚠ · 3 unchecked"*) while anything is open, and pressing either shows a corner toast — *"Bid Check: Fits the roof? — Review · Export anyway."* Review jumps to that row; Export anyway does exactly that — and it remembers: the same set of open rows will not ask again on the next export or copy, so a storage room the design leaves short stops nagging once you have said so. The moment the set changes — a row clears, a new ⚠ appears, a box gets unticked — the toast is back. Resolve the rows and the exports go silent. It never blocks you.

## On the sheet and in the report

Per-size footage and pounds also land in the **legend** [[legend]] (with an all-duct total, toggleable in Legend Settings) and as a **Duct Schedule** table in [Show Report and Export PDFs](/guides/reports-and-exports/) — so the marked-up plan you hand over carries the same numbers you bid.

For the rest of the mechanical scope — room volumes for airflow, diffuser counts, flex and pipe runs — see [Doing an HVAC takeoff](/guides/hvac-takeoff/).

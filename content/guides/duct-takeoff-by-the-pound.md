---
title: Duct takeoff by the pound
description: Trace duct runs with size step-downs, let fittings count themselves, and read one Bid weight off the Duct Schedule — sheet metal priced like a bid.
updated: 2026-09-06
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

Real trunks step down as air leaves them. Mid-trace, press **`S`** (or tap the size chip riding the cursor) to open the step popover: one-tap common step-downs from the current size, or type a custom W×H or Ø. The current segment ends at the last corner you placed and the next one starts at the new size — one continuous run, sized like the shop will build it.

`Enter`, a double-click, or the **Finish Duct Run** bar commits the run. `Esc` steps backward first — it closes the popover, then removes the last corner, then abandons the trace.

## Fittings count themselves

You never click "add elbow." The geometry already says where the fittings are, so the app counts them from the trace:

- a **corner** is an elbow (a shallow bend logs a 45°, a square one a 90°), sized to the duct being bent;
- a **size step** is a transition, sized to the larger end;
- a **run started on another run** is a tap on the parent, sized to the branch collar.

Every inferred fitting is a marker on the sheet. Right-click one to **reclassify** it (45°, boot, offset…) or delete it — your call always outranks the geometry, and re-tracing never resurrects a fitting you removed. It's the same philosophy as the automatic gauge pick: the app does the routine call, you keep the override.

## The Duct Schedule

Click **Schedule** on the Duct section of the sidebar. The schedule prices like a bid:

- **Straight duct by size** — size, gauge, LF, lb/ft, pounds. Round rows also show the **joint count** (spiral lands in 10' sticks), because spiral is catalog-priced by LF as often as by weight.
- **Fittings** — the counted rows (each type and size at its equivalent-weight each), or flip the toggle to **Factor %** and apply one percentage of straight pounds for a quick bid. The default is 40%; both the mode and the percentage stick with the project.
- **Insulation** — liner and wrap square feet, derived from the same footage × perimeter.
- **Seam & waste** — its own labeled line, +15% by default and editable, never buried in a unit price.
- **Bid weight** — the one number that goes on the bid.

On a multi-sheet set the schedule header offers **This sheet / Every sheet**, the same scope language as every export.

**Copy Schedule** puts the whole table on the clipboard as tab-separated text — it pastes into a spreadsheet in columns, into an email legibly, and into PipeTooling alongside your [counts and line types](/guides/reports-and-exports/). Copying runs the same scale check as the other copies: if a sheet with duct on it has no scale, you're told before pixel-length garbage reaches a bid.

## On the sheet and in the report

Per-size footage and pounds also land in the **legend** [[legend]] (with an all-duct total, toggleable in Legend Settings) and as a **Duct Schedule** table in [Show Report and Export PDFs](/guides/reports-and-exports/) — so the marked-up plan you hand over carries the same numbers you bid.

For the rest of the mechanical scope — room volumes for airflow, diffuser counts, flex and pipe runs — see [Doing an HVAC takeoff](/guides/hvac-takeoff/).

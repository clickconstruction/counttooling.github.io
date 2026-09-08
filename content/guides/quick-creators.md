---
title: Building your palette in two clicks
description: The Quick Count and Quick Line creators build correctly-named counters and line types from Size, Type, and Material pickers — no typing, consistent names.
updated: 2026-09-08
order: 3.9
icon: line
category: Counting
---

Typing `2" PVC Waste` forty times per bid is data entry, not estimating. The **Quick** creators build palette items from modifier chips instead — two or three clicks, and the name, color, and icon come out right and *consistent* every time.

## Quick Count — counters from modifiers

Open the Counter [[counter]] modal and switch to the **Quick** tab — that's the Quick Count creator (`Shift`+`Q` jumps to it while the modal is open):

1. Pick a **Size** (2", 3", 4"…), a **Type** (the fixture or fitting), and a **Material**.
2. Watch the name preview assemble itself.
3. **Add** — the counter is created, selected, and ready to place.

Once you've bound an icon to a Type (select the icon, then click the type-icon box next to the Type picker), that Type picks its icon automatically — so a floor drain gets a floor-drain symbol without a trip to the icon grid.

And if the counter you're adding would come out looking identical to one you already have (same icon, same color), the color rotates automatically to a free palette entry — the preview shows the exact color you'll get — so two different fittings never wear the same mark on the sheet.

![The Quick Count tab: pick ① Size, ② Type, and ③ Material — the name assembles itself and the icon follows the type.](/guides/img/quick-count.png)

## The Trade switch

The **Trade** control at the top of the Quick tab — Plumbing, Electrical, HVAC — decides which vocabulary the pickers speak. Plumbing is Size / Type / Material as above. **Electrical** turns them into **Category / Variant / Rating**: pick *Receptacle · Duplex* and the name reads "Duplex Receptacle", the drafting symbol is already selected, and a **Mount height** row appears prefilled with the trade's working figure (18" for a receptacle, 44" for a GFCI at a counter, 48" for a switch) — overwrite it if your job differs. The mount height rides the counter, and the [Chain tool uses it to write the vertical](/guides/electrical-takeoff/) on every run. The trade is per project (Project Settings has the same switch) and remembered as your default for the next bid; each trade keeps its own editable option lists.

## Quick Line — line types from modifiers

The Line [[line]] modal has the same idea on its **Quick** tab: pick a ① **Size** and ② **Material**, and Add creates the line type named and colored, active, and ready to trace.

![The Quick Line tab: pick ① Size and ② Material, and Add creates the line type ready to trace.](/guides/img/quick-line.png)

## Make the modifiers yours

The Size / Type / Material option lists (Category / Variant / Rating for Electrical) are editable — add the sizes and materials your work actually uses, remove the ones it doesn't, right from the pickers. Know what the **−** button does before you tap it: it removes the selected option from your **saved list** immediately — no confirmation, and the change carries into future bids (the last remaining option can't be removed). Trimmed one you still need? Add it back with **+**. Your modifier preferences are part of your profile: save your [Artboard](/guides/artboard-and-palette-insights/) and they follow your account to any device.

## Why this beats typing

- **Consistency** — `2" PVC Waste` is always spelled exactly that way, so tallies, reports, and [Copy to PipeTooling](/guides/reports-and-exports/) group cleanly instead of splitting across three spellings of the same thing.
- **Speed** — a new bid's palette takes a minute, not fifteen.
- **The number row** — pair this with [Quick Keys](/guides/working-faster-with-the-keyboard/) and your freshly built palette is one keystroke away per item.

Related: [Counting fixtures with counters](/guides/counting-with-counters/) · [Measuring runs](/guides/measuring-runs-lines-and-polylines/)

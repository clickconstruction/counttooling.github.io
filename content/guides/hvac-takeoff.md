---
title: Doing an HVAC takeoff
description: Room volumes for airflow and equipment sizing, counters for diffusers and equipment, and duct runs measured off the plan — HVAC estimating on the PDF.
updated: 2026-07-31
order: 9.1
icon: room
category: By trade
---

HVAC estimating starts from a number most takeoff tools can't produce: **how much air is in each room**. CountTooling measures it straight off the plan — then covers the counting and the runs like any other trade.

![A plan with two room boxes drawn on it, each labeled with its room name and length, width, and height.](/guides/img/room-sizer.png)

## Room volumes first

The **Room Sizer** [[room]] tool turns rooms into floor areas (ft²) and air volumes (ft³) — the inputs for ventilation rates, air changes per hour, and rough equipment sizing.

[Set the page scale](/guides/setting-the-scale/) first (room sizes come from the drawing, so the tool won't start without one), pick the Room Sizer (or press `V`), and drag a box across a room (or click two opposite corners) — a live readout shows the length × width while you move. When the second corner lands, the **Room Size** dialog opens:

![The Room Size dialog: ① the dimensions table with live area and volume totals, ② the ceiling height field with recent-height chips, ③ the Add to Room list.](/guides/img/room-size-modal.png)

Everything the dialog does is built for doing a whole floor fast:

1. **The totals table** at the top shows Length and Width read off the plan, the **floor area immediately**, and the **air volume** the moment a height is entered — you see the numbers before you commit.
2. **Ceiling height** takes feet however you'd write them — `9.5` and `9'6` both parse — and heights you've used recently appear as **one-tap chips**, because most rooms on a floor share a few heights.
3. **Add to Room** assigns the box to a room — each room in the list shows its running area and volume so far — or **+ New room** creates one on the spot, with its own color.

After **Apply**, the tool **stays armed** with your last height and room preselected, so the next room is literally two clicks. For an **L-shaped or irregular room**, draw it as two or more boxes assigned to the same room — the room's totals are the sum of its boxes. Boxes render in their room's color with name and L×W×H labels, are edited from their right-click menu, and respect [scale zones](/guides/scale-zones-and-multiply-zones/).

Per-room area and volume land in the Rooms sidebar, on the sheet as labels, in the legend, and in a **Room Volumes** table in the report and email summary. The full walkthrough: [Measuring room volumes](/guides/measuring-room-volumes/).

## Count the equipment

Make a [counter](/guides/counting-with-counters/) [[counter]] per device — diffusers, grilles, exhaust fans, thermostats, equipment — each with its own icon and color ([upload your own symbols](/guides/custom-icons/) to match your schedule). Click each one; the tally rolls up across every sheet. Use [groups](/guides/organizing-a-busy-sheet/) to subtotal by system or by zone.

## Measure the runs

Trace duct and pipe runs with **Line** [[line]] and **Polyline** [[polyline]] tools against the page scale — with [drops](/guides/measuring-runs-lines-and-polylines/) for vertical risers so that footage counts too. Details drawn at another scale on the same sheet? Wrap them in a [scale zone](/guides/scale-zones-and-multiply-zones/) [[scale-zone]]. Typical floors? One [multiply zone](/guides/scale-zones-and-multiply-zones/) [[multiply-zone]] counts them all.

## Deliver the numbers

![The Export PDFs dialog: ① set marker and line sizes, ② choose whether to include the report and bundle highlights/notes, then ③ download.](/guides/img/export-pdfs.png)

- The **legend** [[legend]] and [Show Report](/guides/reports-and-exports/) break everything down by type — counts, lengths, and room volumes.
- **Export PDF** hands over a marked-up plan with the report bundled in.
- **Copy Summary** drops the numbers into an email; totals are always decimal feet, so they line up across mixed sheets.

For the general workflow end to end, see [How to do a takeoff from a PDF](/guides/how-to-do-a-pdf-takeoff/).

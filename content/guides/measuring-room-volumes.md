---
title: Measuring room volumes with the Room Sizer
description: Draw room boxes, give each a ceiling height, and get floor area and air volume per room — the numbers behind airflow, air changes, and equipment sizing.
updated: 2026-07-19
order: 5.5
icon: room
category: Measuring
---

Counting fixtures and measuring runs covers most of a takeoff, but HVAC work starts from a different number: **how much air is in the room**. The Room Sizer turns the rooms on a plan into floor areas (ft²) and air volumes (ft³) — the inputs for ventilation rates, air changes per hour, and rough equipment sizing.

![A plan with two room boxes drawn on it, each labeled with its room name and length, width, and height.](/guides/img/room-sizer.png)

## Draw a room box

1. [Set the page scale](/guides/setting-the-scale/) first — room sizes come from the drawing, so the tool won't start without one.
2. Pick the **Room Sizer** [[room]] tool in the header (or press **V**).
3. Click one corner of the room, then the opposite corner. While you move, a live readout shows the box's length × width.

## Give it a height and a room

When the second corner lands, the Room Size dialog opens:

![The Room Size dialog: the dimensions table, ceiling height field with recent-height chips, and the Add to Room list.](/guides/img/room-size-modal.png)

1. The table at the top shows **Length**, **Width**, and the running totals — floor area immediately, air volume as soon as a height is entered.
2. Enter the **ceiling height** in feet — `9.5` and `9'6` both work. Heights you've used recently appear as one-tap chips.
3. Pick which room the box belongs to under **Add to Room** (each room shows its area and volume so far), or create one with **+ New room**.

The tool stays armed after Apply, so the loop for the next room is just two clicks — your last height and room are already selected.

**L-shaped or irregular room?** Draw it as two or more boxes and assign them all to the same room. The room's area and volume are the sum of its boxes.

## Where the totals show up

- **The Rooms section** appears in the left sidebar as soon as the first box exists — per-room floor area and air volume, with each box listed underneath (click a box row to jump to its page; click the room to rename, recolor, or delete it).
- **The summary legend** gets a row per room with its volume (turn this off in Legend Settings if you don't want it on the sheet).
- **Reports and summaries** include a Room Volumes table with area, volume, and pages per room — see [Reports and exports](/guides/reports-and-exports/).

## Good to know

- On-canvas labels read **L × W × H** with the longer side always shown as (L), so the plan reads the way you'd say it out loud.
- Room boxes respect [scale zones](/guides/scale-zones-and-multiply-zones/): a box drawn fully inside a zone uses that zone's scale. Multiply zones deliberately do **not** multiply volumes — a room spanning identical floors is drawn once per floor.
- Totals are always decimal feet (ft² / ft³), no matter what unit the page scale uses.
- Right-click a box for **Edit room box** (change its height or room, or delete it). The **Delete area** [[delete-area]] tool removes room boxes too.

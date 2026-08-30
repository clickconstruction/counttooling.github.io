---
title: Measuring runs with lines and polylines
description: Trace pipe, conduit, and other linear runs to get real lengths off the plan — straight lines, multi-segment polylines, arcs, drops, and the Measure tool.
updated: 2026-08-30
order: 4
icon: line
category: Measuring
---

> **Just need to check a distance?** You don't have to draw anything: at any time, pick the **Measure** [[measure]] tool (or press `D`), click two points, and read the distance — nothing is added to your takeoff. See *Quick one-off distances* at the bottom of this guide.

Once the [scale is set](/guides/setting-the-scale/), CountTooling can turn any line you draw into a real-world length. That's your linear takeoff — pipe, conduit, trim, anything that runs. On a sheet with no scale yet, these tools pause and show a "Set Scale first" toast — its **Set Scale** link opens the scale dialog right there.

![A measured run drawn across the plan; its real length appears in the legend alongside the counts.](/guides/img/plan-takeoff.png)

Every run belongs to a **line type** — a named template with a color and a straight-or-curved style. Make one for each kind of run you're measuring (waste, vent, conduit) so the totals break down by type.

![The Create Line Type dialog: ① name it, ② choose straight or curved, ③ pick a color.](/guides/img/line-types.png)

## Straight lines

The **Line** [[line]] tool is a two-click straight run: click the start, click the end. While you're aiming, the footer bar shows the running length live, so you can trace to a target footage or check a printed dimension before you commit. The length is read off the page scale and added to the total for that line type. Tap the tool again to start a fresh line.

## Polylines

For a run that bends, use the **Polyline** [[polyline]] tool and click each vertex along the path; finish to close it out. The total length is the sum of every segment, so a service line that weaves across the sheet measures correctly in one shape — and the footer shows the running total as you trace, cursor segment included. Backed into a corner? `Esc` removes the last point (press again to keep unwinding); finish with `Enter` or double-click.

## Arcs and drops

Real runs aren't always flat or straight:

- **Arcs** — line types can be set to curve, so a sweeping run is measured along its arc, not a straight chord.
- **Drops** — give a line a start or end **drop** to account for vertical rise or fall between floors. The vertical footage is added into the length, so risers and stacks count. Set them in **Line Properties** (right-click the line), with ±1/±10 buttons for quick entry:

![Line Properties for a waste line: a 3-foot start drop added to the run, with quick ±1/±10 adjusters.](/guides/img/line-properties.png)

## Reading drops back

On the sheet, a drop is a small ringed marker at the end of its run — but the ring alone doesn't say how much. Two ways to read the number without opening anything:

1. **Point at it.** With the **Move** [[move]] tool, hover over any drop marker — or tap it on a touch screen — and a chip pops up naming the line type and the drop, in the unit you entered it: *"3 ft drop"*, *"6 in drop"*. A click pins the chip in place; clicking, scrolling, or pressing any key dismisses it. Where two runs meet end-to-end, the shared point carries its drop once, so the chip always shows one unambiguous value.

![Tapping a drop marker peeks its size: a chip names the line type and the drop distance.](/guides/img/drop-peek.png)

2. **Label them all.** The **Drop sizes** [[drop-sizes]] button in the header (next to the Hide-marks eye; in the menu drawer on a phone) writes every drop's size right on the sheet, in the same small white chips the length labels use. It's off by default so a dense plan stays clean, only appears once the project actually has drops, and your choice is remembered on this device.

![The Drop sizes toggle on: every drop marker carries its size on the sheet, and the header button lights up.](/guides/img/drop-sizes-toggle.png)

Both are reading aids, not markup: they never ride into [exports, prints, or reports](/guides/reports-and-exports/), and they work in [view-only links](/guides/sharing-and-view-links/) too — so a GC or inspector can read your risers without asking.

## Keep lines clean

- **Snap to 45° angles** (press `J`) locks every segment to horizontal, vertical, or a 45° diagonal — the angles real pipe and conduit runs actually take — so your takeoff looks as tidy as the plan.
- Turn on the **grid** [[grid]] with snapping when you want lines to follow a regular module.

## Quick one-off distances

Just need to check a dimension without adding it to a takeoff? The **Measure** [[measure]] tool gives a distance in two clicks — it appears in the footer bar and stays put while you keep working on that sheet. If those two points fall inside a [scale zone](/guides/scale-zones-and-multiply-zones/), it uses that zone's scale automatically.

With counts and runs both on the plan, you're ready to [review and export](/guides/reports-and-exports/).

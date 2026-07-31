---
title: Measuring runs with lines and polylines
description: Trace pipe, conduit, and other linear runs to get real lengths off the plan — straight lines, multi-segment polylines, arcs, drops, and the Measure tool.
updated: 2026-07-31
order: 4
icon: line
category: Measuring
---

> **Just need to check a distance?** You don't have to draw anything: at any time, pick the **Measure** [[measure]] tool (or press `D`), click two points, and read the distance — nothing is added to your takeoff. See *Quick one-off distances* at the bottom of this guide.

Once the [scale is set](/guides/setting-the-scale/), CountTooling can turn any line you draw into a real-world length. That's your linear takeoff — pipe, conduit, trim, anything that runs.

![A measured run drawn across the plan; its real length appears in the legend alongside the counts.](/guides/img/plan-takeoff.png)

Every run belongs to a **line type** — a named template with a color and a straight-or-curved style. Make one for each kind of run you're measuring (waste, vent, conduit) so the totals break down by type.

![The Create Line Type dialog: ① name it, ② choose straight or curved, ③ pick a color.](/guides/img/line-types.png)

## Straight lines

The **Line** [[line]] tool is a two-click straight run: click the start, click the end. The length is read off the page scale and added to the total for that line type. Tap the tool again to start a fresh line.

## Polylines

For a run that bends, use the **Polyline** [[polyline]] tool and click each vertex along the path; finish to close it out. The total length is the sum of every segment, so a service line that weaves across the sheet measures correctly in one shape.

## Arcs and drops

Real runs aren't always flat or straight:

- **Arcs** — line types can be set to curve, so a sweeping run is measured along its arc, not a straight chord.
- **Drops** — give a line a start or end **drop** to account for vertical rise or fall between floors. The vertical footage is added into the length, so risers and stacks count. Set them in **Line Properties** (right-click the line), with ±1/±10 buttons for quick entry:

![Line Properties for a waste line: a 3-foot start drop added to the run, with quick ±1/±10 adjusters.](/guides/img/line-properties.png)

## Keep lines clean

- **Snap to 45° angles** (press `J`) locks every segment to horizontal, vertical, or a 45° diagonal — the angles real pipe and conduit runs actually take — so your takeoff looks as tidy as the plan.
- Turn on the **grid** [[grid]] with snapping when you want lines to follow a regular module.

## Quick one-off distances

Just need to check a dimension without adding it to a takeoff? The **Measure** [[measure]] tool gives a distance in two clicks. If those two points fall inside a [scale zone](/guides/scale-zones-and-multiply-zones/), it uses that zone's scale automatically.

With counts and runs both on the plan, you're ready to [review and export](/guides/reports-and-exports/).

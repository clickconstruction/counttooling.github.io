---
title: Fixing mistakes and editing marks
description: Undo 50 steps, clear a whole region with Delete Area, edit any mark from its right-click menu, and rename or recolor an entire type at once.
updated: 2026-07-31
order: 4.5
icon: delete-area
category: Working with plans
---

Fast counting means fast mistakes — and that's fine, because everything in CountTooling is quick to take back or change.

## Undo and redo

`Ctrl`+`Z` undoes, `Ctrl`+`Shift`+`Z` redoes, and the history keeps your **last 50 steps** — placements, deletions, moves, scale changes. The [[undo]] button in the bottom bar does the same with a click. Rapid clicking is safe; a misfire is a keystroke away from gone.

## Edit one mark: right-click it

Right-click (or long-press on touch) any mark — counter, line, polyline, highlight, note, zone, room box — for its context menu. The menu names what you hit, so you know exactly what you're touching, and offers **Delete** plus type-specific actions:

![Right-clicking a placed counter: the context menu names the mark (Water Closet) and offers Assign to group and Delete.](/guides/img/context-menu.png)

- **Lines and polylines** — open **Line Properties** to rename, recolor, add or adjust [drops](/guides/measuring-runs-lines-and-polylines/), or edit a polyline's vertices point by point.
- **Notes** — edit the text.
- **Zones and room boxes** — edit their values (multiplier, scale, height/room) or delete them.

In **Move** [[move]] mode you can also click a line to select it (it draws thicker with a glow) and drag notes and the legend wherever they belong.

## Clear a region: Delete Area

When a whole area needs to go — a redesigned restroom, a miscounted wing — don't click marks one by one. Pick the **Delete Area** [[delete-area]] tool and drag a rectangle around the region. A confirmation dialog tells you exactly how many counters, lines, highlights, notes, and zones are inside **before** anything is deleted.

![The Delete Area confirmation names exactly what the region holds — here 14 counters and one 25-foot line run — before anything is removed.](/guides/img/delete-area.png) Confirm once and the region is clear; `Ctrl`+`Z` brings it all back if you overshot.

## Fix a whole type at once

Named the counter wrong? Wrong color for a line type? Open the item's details from the sidebar (the edit pen on its row): **rename**, **recolor**, or **change the icon**, and every placed mark of that type updates everywhere at once. The details dialog also lists which pages the type appears on — click a page to jump there — and offers Delete with a confirmation that tells you how many placed marks it would remove.

## Tool settings, one right-click away

Right-click any tool button — Counter [[counter]], Line [[line]], Polyline [[polyline]], Multiply Zone [[multiply-zone]], Legend [[legend]], Grid [[grid]] — for a small menu with that tool's settings and quick-add actions. Tools without settings say so, so the gesture always answers.

Related: [Keeping a dense takeoff organized](/guides/organizing-a-busy-sheet/) covers groups and filters that make mistakes rarer in the first place.

---
id: plumb.hanger.copper
title: Hanger spacing for copper tube
trade: plumbing
kind: code
status: applied
summary: How far apart copper tube may be supported — 6 feet horizontal at 1-1/4 inch and smaller, 10 feet at 1-1/2 inch and larger, 10 feet vertical.
values:
  - when: horizontal, 1-1/4 in and smaller
    value: 6
    unit: ft
    code: support-model.js#HANGER_SPACING.copper.horizontal[0].ft
  - when: horizontal, 1-1/2 in and larger
    value: 10
    unit: ft
    code: support-model.js#HANGER_SPACING.copper.horizontal[1].ft
  - when: vertical
    value: 10
    unit: ft
    code: support-model.js#HANGER_SPACING.copper.verticalFt
source:
  code: IPC
  section: 308.5, Table 308.5
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/
amendments: []
used_by: [childCount, bidCheck]
updated: 2026-09-09
---

Copper carries its own weight better than plastic, so the spacing is wider and steps up with size. A 60-foot run of 3/4-inch copper is ten hangers; the same run in 2-inch is six.

## What the app does with it

A line type whose name says copper (or Cu, or Type L / K / M) and a size is offered **Hanger · 1 per 6 ft** (10 ft at 1-1/2 in and larger) under Child counts, stamped with this rule; Bid Check's **Hangers on every supported run** row warns while a copper type has none. The count runs on the run's tally length, drops included — a riser is counted at the horizontal spacing, never looser than the code.

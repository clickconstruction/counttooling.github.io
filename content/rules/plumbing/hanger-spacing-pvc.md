---
id: plumb.hanger.pvc
title: Hanger spacing for PVC pipe
trade: plumbing
kind: code
status: applied
summary: How far apart PVC pipe may be supported — 4 feet horizontal, 10 feet vertical.
values:
  - when: horizontal
    value: 4
    unit: ft
    code: support-model.js#HANGER_SPACING.pvc.horizontal[0].ft
  - when: vertical
    value: 10
    unit: ft
    code: support-model.js#HANGER_SPACING.pvc.verticalFt
source:
  code: IPC
  section: 308.5, Table 308.5
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/
amendments: []
used_by: [childCount, bidCheck]
updated: 2026-09-09
---

PVC drainage and vent pipe is supported every 4 feet horizontally, whatever the size, and every 10 feet on a stack. That makes hanger count on a waste line one of the easiest derived quantities on a plumbing bid — length divided by four, rounded up per run.

## What the app does with it

A line type whose name says PVC, ABS or DWV is offered **Hanger · 1 per 4 ft** under Child counts, stamped with this rule; Bid Check's **Hangers on every supported run** row warns while such a type has none. CPVC is a different row of the table and is not matched. The count runs on the run's tally length, drops included.

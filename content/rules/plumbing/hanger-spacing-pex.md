---
id: plumb.hanger.pex
title: Hanger spacing for PEX
trade: plumbing
kind: code
status: applied
summary: How far apart PEX tubing may be supported — 32 inches horizontal at 1 inch and smaller, 48 inches at 1-1/4 inch and larger, 10 feet vertical.
values:
  - when: horizontal, 1 in and smaller
    value: 32
    unit: in
    code: support-model.js#HANGER_SPACING.pex.horizontal[0].in
  - when: horizontal, 1-1/4 in and larger
    value: 48
    unit: in
    code: support-model.js#HANGER_SPACING.pex.horizontal[1].in
  - when: vertical
    value: 10
    unit: ft
    code: support-model.js#HANGER_SPACING.pex.verticalFt
source:
  code: IPC
  section: 308.5, Table 308.5
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/
amendments: []
used_by: [childCount, bidCheck]
updated: 2026-09-09
---

PEX sags between supports, so the code caps the run between hangers tightly for the small sizes. On a takeoff that is one hanger per 32 inches of horizontal 1-inch-and-smaller PEX, rounded up per run — two 13-foot runs are five hangers each, ten in all.

## What the app does with it

A line type whose name says PEX and a size — "1in PEX", '3/4" PEX' — is offered **Hanger · 1 per 32 in** (or 48 in above 1 in) under Child counts in its details, stamped with this rule; the Summary row and every export then carry the hangers, and Bid Check's **Hangers on every supported run** row warns while a PEX type has none. A name with no size gets the tighter spacing, never fewer hangers than the code.

## What it does not do

The count is one hanger per interval of the run's tally length, which includes any drop you gave it — the app does not split a run into horizontal and vertical, so a riser's clamps are counted at the horizontal spacing (tighter than the vertical rule, never looser).

## Verify against your edition

The Uniform Plumbing Code reads the same for PEX (UPC Table 313.3). Check the edition your jurisdiction adopts before a bid rides on the number.

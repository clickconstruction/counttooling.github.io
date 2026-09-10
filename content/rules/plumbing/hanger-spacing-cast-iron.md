---
id: plumb.hanger.cast-iron
title: Hanger spacing for cast-iron pipe
trade: plumbing
kind: code
status: applied
summary: How far apart cast-iron pipe may be supported — 5 feet horizontal (10 feet where 10-foot lengths are installed), 15 feet vertical.
values:
  - when: horizontal
    value: 5
    unit: ft
    note: 10 ft where 10-foot lengths are installed
    code: support-model.js#HANGER_SPACING.cast-iron.horizontal[0].ft
  - when: vertical
    value: 15
    unit: ft
    code: support-model.js#HANGER_SPACING.cast-iron.verticalFt
source:
  code: IPC
  section: 308.5, Table 308.5
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/
amendments: []
used_by: [childCount, bidCheck]
updated: 2026-09-09
---

Cast iron is heavy and joins every 5 or 10 feet, so the support rule follows the joints: a hanger at every 5 feet, or every 10 feet when 10-foot lengths are used, and a riser clamp every 15 feet on a stack. Hubless couplings also want support at each side of the joint, which the base rule does not count.

## What the app does with it

A line type whose name says cast iron (or CI, hubless, no-hub, service weight) is offered **Hanger · 1 per 5 ft** under Child counts, stamped with this rule — the 10-foot-length allowance is yours to apply by editing the interval; Bid Check's **Hangers on every supported run** row warns while such a type has none.

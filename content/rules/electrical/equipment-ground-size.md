---
id: elec.ground.equipment-conductor
title: Equipment grounding conductor size
trade: electrical
kind: code
status: applied
summary: The ground that rides with a feeder is sized from the breaker ahead of it, not from the phase wires, and a 200 A breaker wants a #6 copper ground.
values:
  - when: overcurrent device rated 200 A, copper
    value: "#6"
    unit: AWG
source:
  code: NEC
  section: 250.122, Table 250.122
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: [course]
updated: 2026-09-27
---

The green wire in a feeder does not carry current until something faults, and then it has to carry enough to trip the breaker ahead of it. So its size comes from that breaker's rating, not from the phase conductors: the course's 200 A feeder, four #3/0, carries a #6 copper ground.

On a bid it is its own wire row, a smaller gauge by the same footage, and a takeoff that prices the ground at the phase size overbids the feeder.

## What the app does with it

The electrical course teaches it on a card (Chapter 7, Read the one-line), and `check-lesson-rules` holds the card's numbers to this rule. The app counts the ground you write in a line type's conductors (`4 #3/0 THHN + 1 #6 G`) as its own row; it does not check the size against the breaker.

## Verify against your edition

Table 250.122 gives #6 copper at 200 A. When the phase conductors are upsized (for voltage drop, say), the ground goes up in proportion (250.122(B)), and aluminum has its own column. Local amendments still govern.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.

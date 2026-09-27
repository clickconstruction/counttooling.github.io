---
id: elec.ground.equipment-conductor
title: Equipment grounding conductor size
trade: electrical
kind: code
status: draft
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
used_by: []
updated: 2026-09-26
---

The green wire in a feeder does not carry current until something faults, and then it has to carry enough to trip the breaker ahead of it. So its size comes from that breaker's rating, not from the phase conductors: the course's 200 A feeder, four #3/0, carries a #6 copper ground.

On a bid it is its own wire row, a smaller gauge by the same footage, and a takeoff that prices the ground at the phase size overbids the feeder.

## What the app does with it

Nothing yet. The electrical course teaches it on a card (Chapter 7, Read the one-line). The app counts the ground you write in a line type's conductors (`4 #3/0 THHN + 1 #6 G`) as its own row; it does not check the size against the breaker.

## Verify against your edition

When the phase conductors are upsized for voltage drop, the ground goes up in proportion, and aluminum has its own column. A tester signs the #6 against the adopted edition before this rule is applied.

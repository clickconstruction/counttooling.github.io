---
id: elec.circuit.fixed-equipment
title: Circuits for fixed equipment
trade: electrical
kind: code
status: draft
summary: The code limits what may share a branch circuit with equipment fastened in place, which is why the dishwasher, the pump and the rooftop unit each get a circuit of their own.
values:
  - when: equipment fastened in place, on a 15 or 20 A circuit that also feeds lights or plug-in loads
    value: no more than half the circuit's rating
source:
  code: NEC
  section: "210.23"
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: []
updated: 2026-09-26
---

A fixed appliance that shares a circuit can be tripped by whatever else is plugged into it, and the code limits how much fixed equipment a shared circuit may carry. The simple way to live within it, and the way the course's restaurant does, is to give each piece of equipment a circuit of its own: the dishwasher, the pump, the fan, the ice machine, the heater's controls and the rooftop unit, six circuits for six pieces.

On a bid each of those is a breaker, a homerun the whole way back to the panel, and a disconnect or a cord and plug at the unit. The homeruns are the cost, and they are longer than the device-to-device conduit around them.

## What the app does with it

Nothing yet. The electrical course teaches it on a card (Chapter 6, One circuit each). The app's homerun flag keeps those runs apart from the device-to-device conduit in the report, but it does not check what shares a circuit.

## Verify against your edition

The half-the-rating limit is the 15 and 20 A paragraph of 210.23; the 2023 edition added a paragraph for 10 A circuits ahead of it, so its letter moved. A dedicated circuit is the engineer's design, not a code requirement on its own. A tester signs the reading against the adopted edition before this rule is applied.

---
id: elec.circuit.fixed-equipment
title: Circuits for fixed equipment
trade: electrical
kind: code
status: applied
summary: The code limits what may share a branch circuit with equipment fastened in place, and the simple way to live within it is a circuit each, as the restaurant gives its dishwasher, pump and rooftop unit.
values:
  - when: equipment fastened in place, on a 15 or 20 A circuit that also feeds lights or plug-in loads
    value: no more than half the circuit's rating
source:
  code: NEC
  section: "210.23(B)(2) (210.23(A)(2) in 2017 and 2020)"
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: [course]
updated: 2026-09-27
---

A fixed appliance that shares a circuit can be tripped by whatever else is plugged into it, and the code limits how much fixed equipment a shared circuit may carry: no more than half the rating of a 15 or 20 A circuit that also feeds lights or plug-in loads. The simple way to live within it, and the way the course's restaurant does, is to give each piece of equipment a circuit of its own: the dishwasher, the pump, the fan, the ice machine, the heater's controls and the rooftop unit, six circuits for six pieces. The size of each load, the maker's instructions (110.3(B)) and Article 440 for the rooftop unit do the rest.

On a bid each of those is a breaker, a homerun the whole way back to the panel, and a disconnect or a cord and plug at the unit. The homeruns are the cost, and they are longer than the device-to-device conduit around them.

## What the app does with it

The electrical course teaches it on a card (Chapter 6, One circuit each), and `check-lesson-rules` holds the card's numbers to this rule. The app's homerun flag keeps those runs apart from the device-to-device conduit in the report, but it does not check what shares a circuit.

## Verify against your edition

The half-the-rating limit is the 15 and 20 A paragraph of 210.23: (A)(2) in 2017 and 2020, (B)(2) in 2023, which added a paragraph for 10 A circuits as (A) ahead of it. The 50% bites only where the circuit also feeds lights or plug-in loads; nothing in 210.23 requires a dedicated circuit on its own. A dedicated circuit is the engineer's design. Local amendments still govern.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.

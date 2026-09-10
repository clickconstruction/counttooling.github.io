---
id: elec.voltage-drop.k-constant
title: The K constant for voltage drop
trade: electrical
kind: convention
status: applied
summary: The resistivity figure the estimator's single-phase voltage-drop formula uses — 12.9 for copper, 21.2 for aluminum, in ohm-circular-mils per foot.
values:
  - when: copper conductors
    value: 12.9
    unit: Ω·cmil/ft
    code: bid-check-model.js#VD_K.copper
  - when: aluminum conductors
    value: 21.2
    unit: Ω·cmil/ft
    code: bid-check-model.js#VD_K.aluminum
source:
  code: NEC
  section: Chapter 9, Table 8 (as the trade rounds it)
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: [bidCheck]
updated: 2026-09-09
---

Bid-day voltage drop is `VD = 2 × K × I × L ÷ cmil` for single phase: twice the one-way length, the current, the conductor's circular-mil area, and K — the resistance of a one-foot, one-circular-mil conductor at operating temperature. The trade's working figures are 12.9 for copper and 21.2 for aluminum; they are rounded from the resistance table in Chapter 9, not a value the Code prints as "K".

## What the app does with it

Bid Check's voltage-drop row uses these two figures with the run length it measured (verticals included) and the circular-mil area of the smallest conductor on the circuit. The formula is single-phase; three-phase circuits would use √3 in place of 2, which the app does not yet do.

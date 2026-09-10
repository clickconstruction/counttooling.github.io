---
id: elec.voltage-drop.branch-limit
title: Voltage drop on a branch circuit
trade: electrical
kind: recommendation
status: applied
summary: The app flags a branch circuit whose drop to the farthest device exceeds 3% — the NEC's informational recommendation, not a requirement.
values:
  - when: branch circuit, to the farthest device
    value: 3
    unit: "%"
    code: bid-check-model.js#VD_LIMIT_PCT_DEFAULT
source:
  code: NEC
  section: 210.19(A), Informational Note
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: [bidCheck]
updated: 2026-09-09
---

The Code does not require a maximum voltage drop on a branch circuit; it *recommends* one, in an Informational Note: conductors sized so the drop at the farthest outlet stays within 3% (and 5% for feeder plus branch together) will provide reasonable efficiency of operation. Some jurisdictions and the energy codes turn the recommendation into a requirement, and most specifications do.

## What the app does with it

The **Voltage drop within 3% to the farthest device** row in Bid Check walks each circuit — a group with a panel and circuit number — along its runs to the device farthest from the panel, applies the load and voltage from the Bid Check defaults (or the group's own), and reports the drop with the gauge that would pass when it does not. The 3% is the default limit; the calculation itself uses the K constant on its own page.

## What it does not do

It does not check the feeder side, and it does not know your specification's limit. If the spec says 2%, the row is only a first warning.

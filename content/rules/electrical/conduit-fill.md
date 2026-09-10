---
id: elec.conduit.fill-limit
title: Conduit fill limits
trade: electrical
kind: code
status: applied
summary: How much of a raceway's inside area conductors may fill — 53% for one, 31% for two, 40% for three or more.
values:
  - when: 1 conductor
    value: 53
    unit: "%"
    code: bid-check-model.js#fillLimitFor(1)
    scale: 100
  - when: 2 conductors
    value: 31
    unit: "%"
    code: bid-check-model.js#fillLimitFor(2)
    scale: 100
  - when: 3 or more conductors
    value: 40
    unit: "%"
    code: bid-check-model.js#fillLimitFor(3)
    scale: 100
source:
  code: NEC
  section: Chapter 9, Table 1
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: [bidCheck]
updated: 2026-09-09
---

A raceway is only allowed so full. The limit is a share of the conduit's inside area, and it depends on how many conductors share the run: one conductor may take 53%, two may take 31% between them, and three or more may take 40% together. Nearly every branch run on a plan is the 40% case.

## What the app does with it

The **Conduit fill within the table limit** row in Bid Check adds up the conductors on every run of a line type — the ones you wrote on the type (`3 #12 THHN + 1 #12 G`) or on the run — takes their areas from the insulation family and gauge, divides by the raceway's inside area, and compares with this limit. When a run fails, the row names the smallest trade size of the same raceway that passes.

The conductor and raceway areas come from Chapter 9 Tables 4 and 5 and stay in code, cited there; they are not reprinted on this site.

## What it does not do

It does not apply the 60% nipple allowance, derate for ambient temperature or bundling, or check a cable assembly (MC, NM) — those carry their conductors inside and are counted as one cable row instead.

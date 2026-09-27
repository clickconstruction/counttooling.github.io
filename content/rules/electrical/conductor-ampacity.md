---
id: elec.conductor.ampacity
title: Conductor ampacity
trade: electrical
kind: code
status: draft
summary: The current a conductor may carry, read from the ampacity table in the column its terminals allow: #3/0 copper carries 200 A at 75 °C, which is why a 200 A feeder is #3/0.
values:
  - when: "#3/0 copper THHN, read in the 75 °C terminal column"
    value: 200
    unit: A
source:
  code: NEC
  section: "310.16"
  editions: [2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: []
updated: 2026-09-26
---

Each wire size has an ampacity, the current it may carry continuously, and the table gives it in three temperature columns. The insulation may be rated for the hottest column, but the conductor is read in the column its terminals are rated for, which on most breakers and lugs is 75 °C. That is how the course reads the restaurant's feeder: a 200 A main wants a conductor good for 200 A, and #3/0 copper THHN is 200 A in the 75 °C column.

On a bid the feeder is the heaviest wire on the job and the most expensive by the foot, and its size decides the conduit (2 inches, for four #3/0 and a ground). Reading the wrong column moves the whole run a size.

## What the app does with it

Nothing yet. The electrical course teaches it on two cards (Chapter 1, Read a row, and Chapter 7, Read the one-line). The app counts the feeder's wire from the conductors you write on its line type; it does not check the size against the load.

## Verify against your edition

The table is 310.16 from the 2020 edition on; the 2017 edition numbers it Table 310.15(B)(16). The column the terminals allow comes from 110.14(C), and a hot ambient or more than three current-carrying conductors in one raceway derate the figure. A tester signs the 200 A row against the adopted edition before this rule is applied.

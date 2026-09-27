---
id: plumb.hanger.gas-steel
title: Hanger spacing for steel gas pipe
trade: plumbing
kind: code
status: draft
summary: How far apart steel gas pipe may be supported under the fuel gas code, by size, 6 feet at 1/2 inch, 8 feet at 3/4 and 1 inch, 10 feet horizontal at 1-1/4 inch and larger, and vertical pipe at every floor.
values:
  - when: 1/2 in steel pipe
    value: 6
    unit: ft
  - when: 3/4 in or 1 in steel pipe
    value: 8
    unit: ft
  - when: 1-1/4 in and larger steel pipe, horizontal
    value: 10
    unit: ft
  - when: 1-1/4 in and larger steel pipe, vertical
    value: at every floor level
  - when: corrugated stainless steel tubing (CSST)
    value: per the tubing maker's instructions
source:
  code: IFGC
  section: 415.1, Table 415.1
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/content/IFGC2021P1/chapter-4-gas-piping-installations
amendments: []
used_by: []
updated: 2026-09-27
---

Gas piping is under the fuel gas code, not the plumbing code, and the fuel gas code hangs steel pipe closer than the plumbing code's 12 feet (plumb.hanger.steel). Its spacing steps with size: small pipe sags sooner, so 1/2 inch hangs every 6 feet, 3/4 and 1 inch every 8, and 1-1/4 inch and larger every 10 feet on a horizontal run, with a riser held at every floor. On a takeoff that is one hanger per 10 feet of the course's 1-1/4 inch black steel gas line, rounded up per run.

On a bid that is a fifth more hangers than the plumbing code's 12 feet would give, and a gas line that steps down in size steps down in spacing too: the 3/4 inch branch to a water heater hangs every 8 feet.

## What the app does with it

Nothing yet: the app does not apply this rule. It is on a course card (the plumbing course, Chapter 6, "A hanger row of your own"), which has you add **Hanger · 1 per 10 ft** under the gas line type's Child counts yourself. A gas line type is not offered a hanger row, and Bid Check's hanger row stays quiet about it.

## Verify against your edition

The four steel rows were read in the 2018 IFGC as Seattle adopted it and in ICC's sample pages of the 2021 IFGC, and the same table appears in the IRC's fuel gas chapter (G2424.1). The table also sets the spacing of smooth-wall tubing by size; those rows are not carried here. The Uniform Plumbing Code sets its own gas pipe supports in its Chapter 12 (not opened for this sign-off). Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.

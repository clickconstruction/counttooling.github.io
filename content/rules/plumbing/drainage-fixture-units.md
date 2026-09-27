---
id: plumb.drain.dfu-capacity
title: Building drain and sewer capacity in drainage fixture units
trade: plumbing
kind: code
status: draft
summary: How many drainage fixture units a building drain or sewer may carry by size and slope; at 1/8 inch per foot a 3 inch sewer carries 36 and the course's 4 inch carries 180.
values:
  - when: 3 in building drain or sewer, at 1/8 in per foot
    value: 36
    unit: DFU
  - when: 3 in building drain or sewer, at 1/4 in per foot
    value: 42
    unit: DFU
  - when: 3 in building drain or sewer, at 1/2 in per foot
    value: 50
    unit: DFU
  - when: 4 in building drain or sewer, at 1/8 in per foot
    value: 180
    unit: DFU
  - when: 4 in building drain or sewer, at 1/4 in per foot
    value: 216
    unit: DFU
  - when: 4 in building drain or sewer, at 1/2 in per foot
    value: 250
    unit: DFU
source:
  code: IPC
  section: 710.1, Table 710.1(1)
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/content/IPC2021P1/chapter-7-sanitary-drainage
amendments: []
used_by: []
updated: 2026-09-27
---

The code rates every fixture in drainage fixture units, a measure of how hard it loads the drain (a flush valve water closet dumps a tank in seconds, a lavatory drains a trickle), and sizes the pipe under it from the total. The building drain and the sewer carry everything, so their size is read from the building's whole load at the slope they are laid to. The course's set adds the load to 47 on P-501, well inside the 180 its 4 inch sewer carries at 1/8 inch per foot.

On a bid the check is quick and worth doing: a sewer too small for the load is a bigger pipe and often a deeper trench.

## What the app does with it

Nothing yet: the app does not apply this rule. It is on a course card (the plumbing course, Chapter 9, "What the rows mean"). Bid Check has a manual row, **Fixture units checked against the building drain size**, that you tick when you have read the engineer's total against this table. The app counts no drainage fixture units; the water side's fixture units are a different table (plumb.wsfu.fixtures).

## Verify against your edition

Only the 3 and 4 inch rows the course uses are here; the table covers every drain size. The per-fixture drainage units are IPC Table 709.1, which the sample sheet cites for its DFU column. The six figures matched the 2021 text of Table 710.1(1), whose 1/16 inch column is blank at 3 and 4 inch, and whose footnote keeps a building drain that serves a water closet at 3 inch or larger. The Uniform Plumbing Code sizes drains by its own tables in Chapter 7, with different figures. Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.

---
id: plumb.wsfu.demand
title: Design flow from fixture units
trade: plumbing
kind: code
status: applied
summary: How a load in water supply fixture units becomes a design flow in gallons per minute, on the flush-tank curve or the flush-valve curve, with straight-line reading between the table's rows.
values:
  - when: 1 WSFU, flush tanks
    value: 3
    unit: gpm
    code: water-model.js#demandGpm(1, "flushTank")
  - when: 5 WSFU, flush tanks
    value: 9.4
    unit: gpm
    code: water-model.js#demandGpm(5, "flushTank")
  - when: 10 WSFU, flush tanks
    value: 14.6
    unit: gpm
    code: water-model.js#demandGpm(10, "flushTank")
  - when: 20 WSFU, flush tanks
    value: 19.6
    unit: gpm
    code: water-model.js#demandGpm(20, "flushTank")
  - when: 50 WSFU, flush tanks
    value: 29.1
    unit: gpm
    code: water-model.js#demandGpm(50, "flushTank")
  - when: 100 WSFU, flush tanks
    value: 43.5
    unit: gpm
    code: water-model.js#demandGpm(100, "flushTank")
  - when: 200 WSFU, flush tanks
    value: 65
    unit: gpm
    code: water-model.js#demandGpm(200, "flushTank")
  - when: 500 WSFU, flush tanks
    value: 124
    unit: gpm
    code: water-model.js#demandGpm(500, "flushTank")
  - when: 1000 WSFU, flush tanks
    value: 208
    unit: gpm
    code: water-model.js#demandGpm(1000, "flushTank")
  - when: 5000 WSFU, flush tanks
    value: 593
    unit: gpm
    code: water-model.js#demandGpm(5000, "flushTank")
  - when: 5 WSFU, with flush valves
    value: 15
    unit: gpm
    code: water-model.js#demandGpm(5, "flushValve")
  - when: 10 WSFU, with flush valves
    value: 27
    unit: gpm
    code: water-model.js#demandGpm(10, "flushValve")
  - when: 20 WSFU, with flush valves
    value: 35
    unit: gpm
    code: water-model.js#demandGpm(20, "flushValve")
  - when: 50 WSFU, with flush valves
    value: 50
    unit: gpm
    code: water-model.js#demandGpm(50, "flushValve")
  - when: 100 WSFU, with flush valves
    value: 67.5
    unit: gpm
    code: water-model.js#demandGpm(100, "flushValve")
  - when: 200 WSFU, with flush valves
    value: 90
    unit: gpm
    code: water-model.js#demandGpm(200, "flushValve")
  - when: 500 WSFU, with flush valves
    value: 143
    unit: gpm
    code: water-model.js#demandGpm(500, "flushValve")
  - when: 1000 WSFU, with flush valves
    value: 208
    unit: gpm
    code: water-model.js#demandGpm(1000, "flushValve")
source:
  code: IPC
  section: Appendix E, Table E103.3(3)
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/
amendments: []
used_by: [waterSchedule]
updated: 2026-09-23
---

This is Hunter's curve as the IPC prints it: the probable peak demand for a load of fixture units, which rises steeply at first and then flattens, because the more fixtures there are the smaller the share that runs at once. A system with any flush valve on it reads the steeper column, since a flush valve draws its water in a few seconds. The rows above are a sample of the table for the drift check; the app carries the whole table and reads between its rows in a straight line, the table's own instruction.

## What the app does with it

Rung 4 of the ladder: while a water run is traced, the fixture units still to be served beyond the cursor become a flow through this curve, and the flow becomes the size suggestion in the chip. The gpm shows in the S popover and on the Water Sizing schedule, not on the cursor. Under the first row the flow scales from zero (a lone private lavatory reads about 2 gpm, never a full unit's 3); a flush-valve load under 5 fixture units reads the tank column, where the two meet; past the last row the last value holds.

## What it does not do

A continuous demand (a hose bibb left running, process water, irrigation) is not a fixture unit. The table's note says to estimate it separately and add it, and so the app leaves those fixtures out of the sum rather than pretend a weight for them.

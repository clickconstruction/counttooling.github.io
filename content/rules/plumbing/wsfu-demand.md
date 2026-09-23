---
id: plumb.wsfu.demand
title: Demand curve: fixture units to gallons per minute
trade: plumbing
kind: code
status: applied
summary: The design flow a load of water supply fixture units stands for, in gallons per minute, read off the code's demand table in its flush-tank and flush-valve columns.
values:
  - when: 1 WSFU, flush tanks
    value: 3
    unit: gpm
    code: water-model.js#demandGpm(1, "flush-tank")
  - when: 2 WSFU, flush tanks
    value: 5
    unit: gpm
    code: water-model.js#demandGpm(2, "flush-tank")
  - when: 3 WSFU, flush tanks
    value: 6.5
    unit: gpm
    code: water-model.js#demandGpm(3, "flush-tank")
  - when: 4 WSFU, flush tanks
    value: 8
    unit: gpm
    code: water-model.js#demandGpm(4, "flush-tank")
  - when: 5 WSFU, flush tanks
    value: 9.4
    unit: gpm
    code: water-model.js#demandGpm(5, "flush-tank")
  - when: 6 WSFU, flush tanks
    value: 10.7
    unit: gpm
    code: water-model.js#demandGpm(6, "flush-tank")
  - when: 7 WSFU, flush tanks
    value: 11.8
    unit: gpm
    code: water-model.js#demandGpm(7, "flush-tank")
  - when: 8 WSFU, flush tanks
    value: 12.8
    unit: gpm
    code: water-model.js#demandGpm(8, "flush-tank")
  - when: 9 WSFU, flush tanks
    value: 13.7
    unit: gpm
    code: water-model.js#demandGpm(9, "flush-tank")
  - when: 10 WSFU, flush tanks
    value: 14.6
    unit: gpm
    code: water-model.js#demandGpm(10, "flush-tank")
  - when: 11 WSFU, flush tanks
    value: 15.4
    unit: gpm
    code: water-model.js#demandGpm(11, "flush-tank")
  - when: 12 WSFU, flush tanks
    value: 16
    unit: gpm
    code: water-model.js#demandGpm(12, "flush-tank")
  - when: 13 WSFU, flush tanks
    value: 16.5
    unit: gpm
    code: water-model.js#demandGpm(13, "flush-tank")
  - when: 14 WSFU, flush tanks
    value: 17
    unit: gpm
    code: water-model.js#demandGpm(14, "flush-tank")
  - when: 15 WSFU, flush tanks
    value: 17.5
    unit: gpm
    code: water-model.js#demandGpm(15, "flush-tank")
  - when: 16 WSFU, flush tanks
    value: 18
    unit: gpm
    code: water-model.js#demandGpm(16, "flush-tank")
  - when: 17 WSFU, flush tanks
    value: 18.4
    unit: gpm
    code: water-model.js#demandGpm(17, "flush-tank")
  - when: 18 WSFU, flush tanks
    value: 18.8
    unit: gpm
    code: water-model.js#demandGpm(18, "flush-tank")
  - when: 19 WSFU, flush tanks
    value: 19.2
    unit: gpm
    code: water-model.js#demandGpm(19, "flush-tank")
  - when: 20 WSFU, flush tanks
    value: 19.6
    unit: gpm
    code: water-model.js#demandGpm(20, "flush-tank")
  - when: 25 WSFU, flush tanks
    value: 21.5
    unit: gpm
    code: water-model.js#demandGpm(25, "flush-tank")
  - when: 30 WSFU, flush tanks
    value: 23.3
    unit: gpm
    code: water-model.js#demandGpm(30, "flush-tank")
  - when: 35 WSFU, flush tanks
    value: 24.9
    unit: gpm
    code: water-model.js#demandGpm(35, "flush-tank")
  - when: 40 WSFU, flush tanks
    value: 26.3
    unit: gpm
    code: water-model.js#demandGpm(40, "flush-tank")
  - when: 45 WSFU, flush tanks
    value: 27.7
    unit: gpm
    code: water-model.js#demandGpm(45, "flush-tank")
  - when: 50 WSFU, flush tanks
    value: 29.1
    unit: gpm
    code: water-model.js#demandGpm(50, "flush-tank")
  - when: 60 WSFU, flush tanks
    value: 32
    unit: gpm
    code: water-model.js#demandGpm(60, "flush-tank")
  - when: 70 WSFU, flush tanks
    value: 35
    unit: gpm
    code: water-model.js#demandGpm(70, "flush-tank")
  - when: 80 WSFU, flush tanks
    value: 38
    unit: gpm
    code: water-model.js#demandGpm(80, "flush-tank")
  - when: 90 WSFU, flush tanks
    value: 41
    unit: gpm
    code: water-model.js#demandGpm(90, "flush-tank")
  - when: 100 WSFU, flush tanks
    value: 43.5
    unit: gpm
    code: water-model.js#demandGpm(100, "flush-tank")
  - when: 120 WSFU, flush tanks
    value: 48
    unit: gpm
    code: water-model.js#demandGpm(120, "flush-tank")
  - when: 140 WSFU, flush tanks
    value: 52.5
    unit: gpm
    code: water-model.js#demandGpm(140, "flush-tank")
  - when: 160 WSFU, flush tanks
    value: 57
    unit: gpm
    code: water-model.js#demandGpm(160, "flush-tank")
  - when: 180 WSFU, flush tanks
    value: 61
    unit: gpm
    code: water-model.js#demandGpm(180, "flush-tank")
  - when: 200 WSFU, flush tanks
    value: 65
    unit: gpm
    code: water-model.js#demandGpm(200, "flush-tank")
  - when: 225 WSFU, flush tanks
    value: 70
    unit: gpm
    code: water-model.js#demandGpm(225, "flush-tank")
  - when: 250 WSFU, flush tanks
    value: 75
    unit: gpm
    code: water-model.js#demandGpm(250, "flush-tank")
  - when: 275 WSFU, flush tanks
    value: 80
    unit: gpm
    code: water-model.js#demandGpm(275, "flush-tank")
  - when: 300 WSFU, flush tanks
    value: 85
    unit: gpm
    code: water-model.js#demandGpm(300, "flush-tank")
  - when: 400 WSFU, flush tanks
    value: 105
    unit: gpm
    code: water-model.js#demandGpm(400, "flush-tank")
  - when: 500 WSFU, flush tanks
    value: 124
    unit: gpm
    code: water-model.js#demandGpm(500, "flush-tank")
  - when: 750 WSFU, flush tanks
    value: 170
    unit: gpm
    code: water-model.js#demandGpm(750, "flush-tank")
  - when: 1000 WSFU, flush tanks
    value: 208
    unit: gpm
    code: water-model.js#demandGpm(1000, "flush-tank")
  - when: 1250 WSFU, flush tanks
    value: 239
    unit: gpm
    code: water-model.js#demandGpm(1250, "flush-tank")
  - when: 1500 WSFU, flush tanks
    value: 269
    unit: gpm
    code: water-model.js#demandGpm(1500, "flush-tank")
  - when: 1750 WSFU, flush tanks
    value: 297
    unit: gpm
    code: water-model.js#demandGpm(1750, "flush-tank")
  - when: 2000 WSFU, flush tanks
    value: 325
    unit: gpm
    code: water-model.js#demandGpm(2000, "flush-tank")
  - when: 2500 WSFU, flush tanks
    value: 380
    unit: gpm
    code: water-model.js#demandGpm(2500, "flush-tank")
  - when: 3000 WSFU, flush tanks
    value: 433
    unit: gpm
    code: water-model.js#demandGpm(3000, "flush-tank")
  - when: 4000 WSFU, flush tanks
    value: 525
    unit: gpm
    code: water-model.js#demandGpm(4000, "flush-tank")
  - when: 5000 WSFU, flush tanks
    value: 593
    unit: gpm
    code: water-model.js#demandGpm(5000, "flush-tank")
  - when: 5 WSFU, flush valves
    value: 15
    unit: gpm
    code: water-model.js#demandGpm(5, "flush-valve")
  - when: 6 WSFU, flush valves
    value: 17.4
    unit: gpm
    code: water-model.js#demandGpm(6, "flush-valve")
  - when: 7 WSFU, flush valves
    value: 19.8
    unit: gpm
    code: water-model.js#demandGpm(7, "flush-valve")
  - when: 8 WSFU, flush valves
    value: 22.2
    unit: gpm
    code: water-model.js#demandGpm(8, "flush-valve")
  - when: 9 WSFU, flush valves
    value: 24.6
    unit: gpm
    code: water-model.js#demandGpm(9, "flush-valve")
  - when: 10 WSFU, flush valves
    value: 27
    unit: gpm
    code: water-model.js#demandGpm(10, "flush-valve")
  - when: 11 WSFU, flush valves
    value: 27.8
    unit: gpm
    code: water-model.js#demandGpm(11, "flush-valve")
  - when: 12 WSFU, flush valves
    value: 28.6
    unit: gpm
    code: water-model.js#demandGpm(12, "flush-valve")
  - when: 13 WSFU, flush valves
    value: 29.4
    unit: gpm
    code: water-model.js#demandGpm(13, "flush-valve")
  - when: 14 WSFU, flush valves
    value: 30.2
    unit: gpm
    code: water-model.js#demandGpm(14, "flush-valve")
  - when: 15 WSFU, flush valves
    value: 31
    unit: gpm
    code: water-model.js#demandGpm(15, "flush-valve")
  - when: 16 WSFU, flush valves
    value: 31.8
    unit: gpm
    code: water-model.js#demandGpm(16, "flush-valve")
  - when: 17 WSFU, flush valves
    value: 32.6
    unit: gpm
    code: water-model.js#demandGpm(17, "flush-valve")
  - when: 18 WSFU, flush valves
    value: 33.4
    unit: gpm
    code: water-model.js#demandGpm(18, "flush-valve")
  - when: 19 WSFU, flush valves
    value: 34.2
    unit: gpm
    code: water-model.js#demandGpm(19, "flush-valve")
  - when: 20 WSFU, flush valves
    value: 35
    unit: gpm
    code: water-model.js#demandGpm(20, "flush-valve")
  - when: 25 WSFU, flush valves
    value: 38
    unit: gpm
    code: water-model.js#demandGpm(25, "flush-valve")
  - when: 30 WSFU, flush valves
    value: 42
    unit: gpm
    code: water-model.js#demandGpm(30, "flush-valve")
  - when: 35 WSFU, flush valves
    value: 44
    unit: gpm
    code: water-model.js#demandGpm(35, "flush-valve")
  - when: 40 WSFU, flush valves
    value: 46
    unit: gpm
    code: water-model.js#demandGpm(40, "flush-valve")
  - when: 45 WSFU, flush valves
    value: 48
    unit: gpm
    code: water-model.js#demandGpm(45, "flush-valve")
  - when: 50 WSFU, flush valves
    value: 50
    unit: gpm
    code: water-model.js#demandGpm(50, "flush-valve")
  - when: 60 WSFU, flush valves
    value: 54
    unit: gpm
    code: water-model.js#demandGpm(60, "flush-valve")
  - when: 70 WSFU, flush valves
    value: 58
    unit: gpm
    code: water-model.js#demandGpm(70, "flush-valve")
  - when: 80 WSFU, flush valves
    value: 61.2
    unit: gpm
    code: water-model.js#demandGpm(80, "flush-valve")
  - when: 90 WSFU, flush valves
    value: 64.3
    unit: gpm
    code: water-model.js#demandGpm(90, "flush-valve")
  - when: 100 WSFU, flush valves
    value: 67.5
    unit: gpm
    code: water-model.js#demandGpm(100, "flush-valve")
  - when: 120 WSFU, flush valves
    value: 73
    unit: gpm
    code: water-model.js#demandGpm(120, "flush-valve")
  - when: 140 WSFU, flush valves
    value: 77
    unit: gpm
    code: water-model.js#demandGpm(140, "flush-valve")
  - when: 160 WSFU, flush valves
    value: 81
    unit: gpm
    code: water-model.js#demandGpm(160, "flush-valve")
  - when: 180 WSFU, flush valves
    value: 85.5
    unit: gpm
    code: water-model.js#demandGpm(180, "flush-valve")
  - when: 200 WSFU, flush valves
    value: 90
    unit: gpm
    code: water-model.js#demandGpm(200, "flush-valve")
  - when: 225 WSFU, flush valves
    value: 95.5
    unit: gpm
    code: water-model.js#demandGpm(225, "flush-valve")
  - when: 250 WSFU, flush valves
    value: 101
    unit: gpm
    code: water-model.js#demandGpm(250, "flush-valve")
  - when: 275 WSFU, flush valves
    value: 104.5
    unit: gpm
    code: water-model.js#demandGpm(275, "flush-valve")
  - when: 300 WSFU, flush valves
    value: 108
    unit: gpm
    code: water-model.js#demandGpm(300, "flush-valve")
  - when: 400 WSFU, flush valves
    value: 127
    unit: gpm
    code: water-model.js#demandGpm(400, "flush-valve")
  - when: 500 WSFU, flush valves
    value: 143
    unit: gpm
    code: water-model.js#demandGpm(500, "flush-valve")
  - when: 750 WSFU, flush valves
    value: 177
    unit: gpm
    code: water-model.js#demandGpm(750, "flush-valve")
  - when: 1000 WSFU, flush valves
    value: 208
    unit: gpm
    code: water-model.js#demandGpm(1000, "flush-valve")
  - when: 1250 WSFU, flush valves
    value: 239
    unit: gpm
    code: water-model.js#demandGpm(1250, "flush-valve")
  - when: 1500 WSFU, flush valves
    value: 269
    unit: gpm
    code: water-model.js#demandGpm(1500, "flush-valve")
  - when: 1750 WSFU, flush valves
    value: 297
    unit: gpm
    code: water-model.js#demandGpm(1750, "flush-valve")
  - when: 2000 WSFU, flush valves
    value: 325
    unit: gpm
    code: water-model.js#demandGpm(2000, "flush-valve")
  - when: 2500 WSFU, flush valves
    value: 380
    unit: gpm
    code: water-model.js#demandGpm(2500, "flush-valve")
  - when: 3000 WSFU, flush valves
    value: 433
    unit: gpm
    code: water-model.js#demandGpm(3000, "flush-valve")
  - when: 4000 WSFU, flush valves
    value: 525
    unit: gpm
    code: water-model.js#demandGpm(4000, "flush-valve")
  - when: 5000 WSFU, flush valves
    value: 593
    unit: gpm
    code: water-model.js#demandGpm(5000, "flush-valve")
source:
  code: IPC
  section: Appendix E, Table E103.3(3)
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/
amendments: []
used_by: [waterSchedule]
updated: 2026-09-23
---

Fixture units are not a flow. The code converts a load to a design flow with a demand table (the Hunter curve): the more fixtures on a pipe, the smaller the share that runs at once, so the flow climbs more slowly than the load. It prints two columns: systems predominantly for **flush tanks** and systems predominantly for **flush valves**, whose short heavy draws need more water at the same load. Between the printed points the code has you interpolate on a straight line.

## What the app does with it

Every size suggestion in the water-sizing ladder starts here: the fixture units still to serve beyond a point on a run are converted to gallons per minute in the column the run's fixtures call for, then to a pipe size at the velocity cap. The app interpolates between the printed rows; a load under 1 WSFU reads down to zero with the load; a flush-valve load under 5 WSFU (below the first printed row) reads the flush-tank column; a load past 5,000 WSFU holds the last value, and the schedule says so, because a main that size is an engineer's calculation.

## What it does not do

It does not size by pressure and developed length (Appendix E's full method, Tables E103.3(4) to E103.3(7)). That is the master's calculation, and the app leaves it to Bid Check as a manual row until the critical-path math exists.

---
id: plumb.water.velocity
title: Design velocity for water pipe
trade: plumbing
kind: convention
status: applied
summary: The velocity the app sizes a water run to, 8 feet per second cold and 5 feet per second hot. Design practice, not a code table; the code's own method sizes by pressure and length.
values:
  - when: Cold water
    value: 8
    unit: fps
    code: water-model.js#WATER_VELOCITY_CAP_FPS.cold
  - when: Hot water
    value: 5
    unit: fps
    code: water-model.js#WATER_VELOCITY_CAP_FPS.hot
source:
  code: ASPE
  section: Plumbing Engineering Design Handbook, Vol. 2, Ch. 5 (cold water) and Ch. 6 (hot water), velocity limits; Copper Development Association, Copper Tube Handbook, "velocity" (5 fps hot, 8 fps cold)
  editions: []
  url: https://www.copper.org/publications/pub_list/pdf/copper_tube_handbook.pdf
amendments: []
used_by: [waterSchedule]
updated: 2026-09-23
---

No model code prints a velocity limit for water pipe. The IPC's Appendix E sizes by the pressure available and the developed length of the critical run; velocity is the trade's design practice, kept because fast water erodes fittings, hammers valves and is loud in a wall. The figures most guidance agrees on are 8 feet per second for cold water and 5 for hot (lower still above 140 °F), and they are what an estimator pencils in on a walk-through.

## What the app does with it

The size suggestion at the S moment (rung 4 of the water-sizing ladder) is the smallest nominal size whose velocity, at the design flow for the fixture units still to serve, stays under the cap for the run's side. The two caps are knobs on the Water Sizing schedule (rung 5) and stick with the project; the schedule foot stamps the result *"sized at 5 / 8 fps; the pressure check is Bid Check's"* so nobody mistakes a rule of thumb for a design.

## What it does not do

It does not check the pressure at the farthest fixture. That is Appendix E's full calculation and stays a manual Bid Check row, *Pressure available checked (Appendix E)*, until the critical-path math exists.

---
id: plumb.water.velocity
title: Design velocity for water pipe
trade: plumbing
kind: convention
status: applied
summary: The velocity the app sizes a water run to, 8 feet per second cold and 5 feet per second hot. Design practice under the IPC, which prints no velocity limit; the UPC caps copper tube at the same figures.
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
updated: 2026-09-27
---

The IPC prints no velocity limit for water pipe. Its Appendix E sizes by the pressure available and the developed length of the critical run, at a velocity the designer selects from the pipe makers' recommendations. The Uniform Plumbing Code does print one: a copper or copper-alloy tube system runs no faster than 8 feet per second cold and 5 hot (610.12 in the 2021 edition). So in a UPC state the two caps are code; under the IPC they are the trade's design practice. Either way the reason is the same: fast water erodes fittings, hammers valves and is loud in a wall. The same 8 and 5 are what most design guidance agrees on, and what an estimator pencils in on a walk-through. Hotter water wants less: above 140 °F the Copper Tube Handbook keeps hot water to 2 to 3 feet per second.

## What the app does with it

The size suggestion at the S moment (rung 4 of the water-sizing ladder) is the smallest nominal size whose velocity, at the design flow for the fixture units still to serve, stays under the cap for the run's side. The two caps are knobs on the Water Sizing schedule (rung 5) and stick with the project; the schedule foot stamps the result *"sized at 5 / 8 fps; the pressure check is Bid Check's"* so nobody mistakes a rule of thumb for a design. The app keeps one hot cap per project and does not know the water's temperature: on a job whose hot loop runs above 140 °F (a recirculated or a 160 °F kitchen loop), lower the hot cap on the schedule.

## What it does not do

It does not check the pressure at the farthest fixture. That is Appendix E's full calculation and stays a manual Bid Check row, *Pressure available checked (Appendix E)*, until the critical-path math exists.

## Verify against your edition

The UPC figure was read in a state's adoption of the UPC 2021, not in IAPMO's own book; a UPC jurisdiction reads its adopted section. A jurisdiction or an engineer may set lower caps, and the schedule's knobs take them. Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.

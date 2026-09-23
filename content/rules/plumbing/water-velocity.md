---
id: plumb.water.velocity
title: Velocity cap for water piping
trade: plumbing
kind: convention
status: applied
summary: The speed the app will not let a suggested size exceed, cold water at 8 feet per second and hot at 5, the rule of thumb a walk-through size is penciled to; the pressure and developed-length calculation stays with Bid Check.
values:
  - when: cold water
    value: 8
    unit: ft/s
    code: water-model.js#WATER_VELOCITY_CAPS.cold
  - when: hot water
    value: 5
    unit: ft/s
    code: water-model.js#WATER_VELOCITY_CAPS.hot
source:
  code: trade practice
  section: design guidance from the tube and fitting makers and the plumbing engineering handbooks; the IPC's Appendix E sizes by pressure available and developed length instead
  editions: []
amendments: []
used_by: [waterSchedule, bidCheck]
updated: 2026-09-23
---

Neither number is code. They are the ceilings a designer sizes water piping under so that it stays quiet and lasts: fast water hammers, erodes copper at the fittings and wears the insert fittings in PEX, and hot water does all of that sooner, so it is held slower. The code's own method (IPC Appendix E, Tables E103.3(4) to (7)) sizes by the pressure available at the meter and the developed length of the critical run; that is the master's full calculation, and in the app it belongs to Bid Check, not to the moment a run is being traced.

## What the app does with it

Rung 4 of the ladder: the size the chip suggests at S is the smallest size of the run's material whose velocity at the design flow stays under the cap for its side, stamped practice, not code. Rung 5 puts both caps at the foot of the Water Sizing schedule as knobs that stick with the project, the way the Duct Schedule keeps its friction rate and velocity ceiling.

## What it does not do

A size that passes the cap is not a size that passes the pressure check. The schedule's foot says so, and Bid Check carries a manual row, pressure available checked, until the critical-path math exists to answer it.

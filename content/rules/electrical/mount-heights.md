---
id: elec.mount-height.defaults
title: Default mount heights for devices
trade: electrical
kind: convention
status: applied
summary: The heights above finished floor the app starts each device at — 18" receptacles, 44" GFCI at a counter, 48" switches, 78" panel top — so the Chain tool can write the vertical.
values:
  - when: Duplex receptacle, to center
    value: 18
    unit: in AFF
    code: constants.js#ELECTRICAL_DEFAULTS.mountByType.Duplex
  - when: GFCI receptacle at a counter
    value: 44
    unit: in AFF
    code: constants.js#ELECTRICAL_DEFAULTS.mountByType.GFCI
  - when: Single-pole switch
    value: 48
    unit: in AFF
    code: constants.js#ELECTRICAL_DEFAULTS.mountByType["Single Pole"]
  - when: Panelboard, to the top
    value: 78
    unit: in AFF
    code: constants.js#ELECTRICAL_DEFAULTS.mountByType.Panelboard
  - when: Exit sign
    value: 90
    unit: in AFF
    code: constants.js#ELECTRICAL_DEFAULTS.mountByType.Exit
  - when: Data outlet
    value: 18
    unit: in AFF
    code: constants.js#ELECTRICAL_DEFAULTS.mountByType["Data Outlet"]
  - when: Thermostat
    value: 48
    unit: in AFF
    code: constants.js#ELECTRICAL_DEFAULTS.mountByType.Thermostat
source:
  code: NEC
  section: 404.8(A), 240.24(A); ADA 308 reach range
  editions: [2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: [chain, quickCreate]
updated: 2026-09-09
---

No code tells you a receptacle goes at 18 inches. The NEC only caps how high a switch or a breaker handle may be (6 ft 7 in), and accessibility rules bound the reach range (15 to 48 inches for an unobstructed forward reach). Inside those, the trade has working figures, and the architect's elevations or the specification override them job by job.

## What the app does with it

When you create a device on the Quick tab, its mount height is prefilled from this list and rides the counter; you can overwrite it before you Add or edit it later. The Chain tool then writes ceiling height minus mount height plus make-up as the vertical on every run it draws to that device. The panel figure is to the top of the can, which is what the homerun's vertical needs.

## What it does not do

It does not read heights off the drawings. A device schedule that says 42 inches wins, and the counter is where you say so.

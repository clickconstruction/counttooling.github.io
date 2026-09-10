---
id: hvac.duct.sheet-weight
title: Galvanized sheet weight by gauge
trade: hvac
kind: standard
status: applied
summary: Pounds per square foot of galvanized steel sheet at each gauge — the basis of every duct weight the schedule reports.
values:
  - when: 26 gauge
    value: 0.906
    unit: lb/ft²
    code: duct-model.js#SHEET_WEIGHT_LB_PER_SQFT[26]
  - when: 24 gauge
    value: 1.156
    unit: lb/ft²
    code: duct-model.js#SHEET_WEIGHT_LB_PER_SQFT[24]
  - when: 22 gauge
    value: 1.406
    unit: lb/ft²
    code: duct-model.js#SHEET_WEIGHT_LB_PER_SQFT[22]
  - when: 20 gauge
    value: 1.656
    unit: lb/ft²
    code: duct-model.js#SHEET_WEIGHT_LB_PER_SQFT[20]
  - when: 18 gauge
    value: 2.156
    unit: lb/ft²
    code: duct-model.js#SHEET_WEIGHT_LB_PER_SQFT[18]
source:
  code: ASTM
  section: A653 / A924, nominal galvanized sheet weight by gauge
  editions: []
  url: https://www.astm.org/
amendments: []
used_by: [ductSchedule]
updated: 2026-09-09
---

Duct is bought by the pound and bid by the pound. The weight of a run is its surface area — the perimeter of the size times the length — times the sheet weight at its gauge. These are the nominal galvanized figures the trade quotes; a specific coating class shifts them by a few percent.

## What the app does with it

The Duct Schedule multiplies each run's perimeter in feet by its length and by this figure to report pounds per size, then adds fittings as pound-equivalents and the seam & waste percentage on top. Change a gauge and the pounds follow.

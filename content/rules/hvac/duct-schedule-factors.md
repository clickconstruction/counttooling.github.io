---
id: hvac.duct.schedule-factors
title: Duct Schedule factors
trade: hvac
kind: convention
status: applied
summary: The estimating knobs the Duct Schedule starts with — seam and waste, the quick-bid fitting factor, and the design friction rate and velocity cap the ductulator suggests sizes from.
values:
  - when: seam and waste, on the straight-duct pounds
    value: 15
    unit: "%"
    code: duct-model.js#DUCT_SETTINGS_DEFAULTS.seamWastePct
  - when: fitting factor, when fittings are not counted individually
    value: 40
    unit: "%"
    code: duct-model.js#DUCT_SETTINGS_DEFAULTS.fittingFactorPct
  - when: design friction rate for size suggestions
    value: 0.08
    unit: in w.g. per 100 ft
    code: duct-model.js#DUCT_SETTINGS_DEFAULTS.frictionInPer100ft
  - when: maximum velocity for size suggestions
    value: 1200
    unit: fpm
    code: duct-model.js#DUCT_SETTINGS_DEFAULTS.maxVelocityFpm
source:
  code: trade practice
  section: estimating convention; ASHRAE Fundamentals duct design for the rate and velocity
  editions: []
amendments: []
used_by: [ductSchedule]
updated: 2026-09-09
---

None of these is a code figure. They are the numbers a sheet-metal estimator carries: a percentage on the straight pounds for seams, laps and the offcuts that never leave the shop; a percentage that stands in for fittings on a quick bid; and the friction rate and velocity ceiling a designer sizes low-pressure supply to, which is what the ductulator suggestions in the size chip use.

## What the app does with it

The Duct Schedule modal shows all four on its Suggestions row and applies them per project; they are saved with the project and restored on every load. Counted fittings replace the fitting factor when you switch the mode.

## What it does not do

The suggestions size for friction and velocity only. They do not account for noise criteria, available static, or an engineer's schedule, which wins when there is one.

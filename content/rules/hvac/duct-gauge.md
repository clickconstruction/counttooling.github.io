---
id: hvac.duct.gauge-schedule
title: Duct gauge by size and pressure class
trade: hvac
kind: standard
status: applied
summary: The simplified gauge schedule the Duct tool picks metal with — by the duct's larger side or diameter and the system's pressure class — before you override it.
values:
  - when: 1 in w.g., larger side up to 12 in
    value: 26
    unit: ga
    code: duct-model.js#DUCT_GAUGE_TABLE["1"][0].gauge
  - when: 1 in w.g., up to 30 in
    value: 24
    unit: ga
    code: duct-model.js#DUCT_GAUGE_TABLE["1"][1].gauge
  - when: 1 in w.g., up to 54 in
    value: 22
    unit: ga
    code: duct-model.js#DUCT_GAUGE_TABLE["1"][2].gauge
  - when: 1 in w.g., up to 84 in
    value: 20
    unit: ga
    code: duct-model.js#DUCT_GAUGE_TABLE["1"][3].gauge
  - when: 1 in w.g., larger
    value: 18
    unit: ga
    code: duct-model.js#DUCT_GAUGE_TABLE["1"][4].gauge
  - when: 2 in w.g., larger side up to 10 in
    value: 26
    unit: ga
    code: duct-model.js#DUCT_GAUGE_TABLE["2"][0].gauge
  - when: 3 in w.g., larger side up to 8 in
    value: 26
    unit: ga
    code: duct-model.js#DUCT_GAUGE_TABLE["3"][0].gauge
source:
  code: SMACNA
  section: HVAC Duct Construction Standards, gauge tables (simplified)
  editions: [2020]
  url: https://www.smacna.org/
amendments: []
used_by: [ductSchedule]
updated: 2026-09-09
---

SMACNA's construction standard sets gauge together with reinforcement: a thinner sheet with more frequent reinforcement can meet the same pressure class as a thicker one with less. An estimate does not need that trade-off resolved; it needs a defensible gauge per size to turn feet into pounds.

## What the app does with it

The Duct tool picks a gauge from this schedule the moment you give a run a size, keyed on the larger rectangular side or the round diameter and on the pressure class (½, 1, 2 or 3 in w.g.). The schedule steps thinner sizes down one gauge at higher pressure classes. Every pick is an override away: change it in the size chip and the weight recalculates.

## What it does not do

This is the simplified schedule, gauge only. It does not choose reinforcement, joint type, or seam, and it is not the SMACNA table reprinted — the standard's own tables are the source for anything submitted.

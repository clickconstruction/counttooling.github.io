---
id: plumb.water.distribution-min
title: Minimum water service size
trade: plumbing
kind: code
status: draft
summary: The water service pipe from the main to the building is never smaller than 3/4 inch; the pipes past it are sized to the fixtures they serve.
values:
  - when: Water service pipe
    value: 3/4
    unit: in
    code: water-model.js#sizeFraction(0.75)
source:
  code: IPC
  section: "603.1"
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/
amendments: []
used_by: []
updated: 2026-09-23
---

The service from the utility main to the building is sized for the whole load by the Appendix E method, but whatever that gives, it is never smaller than 3/4 inch. Inside the building the distribution piping has no single floor of its own: each fixture supply has its minimum (the fixture supply rule), and the branches and mains between are sized to the fixture units they carry.

## What the app does with it

Bid Check's water rows (rung 6 of the water-sizing ladder) warn when a run that reads as the service (the first run in from the meter, or one named *service*) is smaller than 3/4 inch. Until then the value sits in the rulebook for the estimator to read.

## What it does not do

It does not find the meter or the point of entry on the drawing; the estimator's line type names say which run is the service.

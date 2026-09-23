---
id: plumb.water.service-min
title: Minimum water service size
trade: plumbing
kind: code
status: draft
summary: The pipe from the main to the building is never smaller than 3/4 inch, whatever the load says.
values:
  - when: water service pipe, from the main to the building
    value: "3/4"
    unit: in
    code: water-model.js#sizeKey(0.75)
source:
  code: IPC
  section: "603.1"
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/
amendments: []
used_by: []
updated: 2026-09-23
---

The code sizes the water service by the method in Appendix E, or by an approved engineering method, and then puts a floor under the answer: never less than three quarters of an inch. On a commercial bid the load carries the service well above the floor; the rule matters on the small end, a kiosk or a single-restroom tenant, where a method run honestly might otherwise answer half an inch.

## What the app will do with it

Rung 6 of the ladder: a Bid Check row, distribution minimums, that warns when the run at the meter is under 3/4 inch. Until then it is here so the walkthrough can check the number with the rest of the slice.

## What it does not do

The distribution piping beyond the service has no single minimum in the section; it is sized by the method and floored per fixture by Table 604.5.

---
id: elec.ground.electrode-conductor
title: Grounding electrode conductor size
trade: electrical
kind: code
status: draft
summary: The conductor from the service to the water pipe and the ground rods is sized from the service conductors, and #3/0 copper service conductors want a #4 copper grounding electrode conductor.
values:
  - when: "copper service conductors #2/0 or #3/0, copper electrode conductor"
    value: "#4"
    unit: AWG
source:
  code: NEC
  section: 250.66, Table 250.66
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: []
updated: 2026-09-26
---

The grounding electrode conductor ties the service to the earth: to the metal water pipe, the ground rods, the building steel. Its size comes from the largest service conductor, so the course's service, #3/0 copper, gets a #4 copper grounding electrode conductor.

On a bid it is a short run of heavy bare or green wire, clamps and rods that the one-line draws and the floor plan does not, easy to leave off.

## What the app does with it

Nothing yet. The electrical course teaches it on a card (Chapter 7, Read the one-line). The app counts it only if you draw it and write its conductor.

## Verify against your edition

The run that goes only to the ground rods never has to be larger than #6 copper (250.66(A)); the #4 is the table's figure for the water pipe connection. A tester signs the row against the adopted edition before this rule is applied.

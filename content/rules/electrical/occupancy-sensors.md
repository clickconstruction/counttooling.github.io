---
id: elec.lighting.occupancy-sensors
title: Occupant sensor lighting controls
trade: electrical
kind: code
status: applied
summary: The energy code wants the lights in rooms people leave, restrooms, storage and break rooms among them, on sensors that turn them off by themselves, and every other area on a time switch.
values:
  - when: restrooms, storage rooms, break rooms and the other spaces the section lists (2021 adds corridors; enclosed spaces of 300 sq ft or less are listed)
    value: an occupant sensor that turns the lights off
  - when: every other area, not on occupant sensors (C405.2.2)
    value: time-switch control that turns the lights off on a schedule
source:
  code: IECC
  section: C405.2.1, C405.2.2
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/
amendments: []
used_by: [course]
updated: 2026-09-27
---

This one is the energy code, not the electrical code. In the rooms people walk into and leave, restrooms, storage, break rooms, the lights must turn themselves off when the room is empty, so the switch by the door becomes an occupancy sensor. Small rooms closed in by full-height walls are on the list too, and the 2021 edition adds corridors. Every other area gets time-switch control (C405.2.2): a dining room, occupied whenever the restaurant is, gets a time switch that turns the lights off after hours, and a dimmer is the designer's choice on top of it.

So on the course's restaurant, read to the 2021 edition, the restrooms and storage the engineer put on sensors are right, and the hall (a corridor) and the mop room (a small closed room) want sensors too. The course teaches that as an RFI, with two more sensors carried in the bid until it is answered.

On a bid an occupancy sensor is a device, a box and a plate like a switch, at a different price, and it is the plan's answer to the Lighting controls meet the energy code row in Bid Check.

## What the app does with it

The electrical course teaches it on a card (Chapter 3, Why those three rooms), and `check-lesson-rules` holds the card's numbers to this rule. The Quick tab offers an Occupancy switch variant and Bid Check carries the lighting controls row as a manual tick, but the app does not decide which rooms need a sensor.

## Verify against your edition

The list of spaces, the time the lights may stay on after the room empties, and the exceptions are in the sub-paragraphs and change between editions: corridors joined the list in 2021. The 2018 and 2021 text was read second hand (the ICC pages would not open); C405.2.1 keeps its number and its 300 sq ft item in a state adoption of the 2024 edition that was opened. A local energy code or amendment still governs.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.

---
id: hvac.ventilation.outdoor-air
title: Outdoor air for ventilation
trade: hvac
kind: code
status: draft
summary: Occupied spaces get a code minimum of outdoor air, set by the kind of room, the people in it and its floor area; on a bid the question is whether the plan's supply already carries it or a separate unit does.
values:
  - when: outdoor air to an occupied space, by mechanical or natural ventilation
    value: required
  - when: the minimum, by occupancy
    value: per person plus per floor area
source:
  code: IMC
  section: 403 Mechanical ventilation (rates in Table 403.3.1.1)
  editions: [2021]
  url: https://codes.iccsafe.org/content/IMC2021P1/chapter-4-ventilation
amendments: []
used_by: []
updated: 2026-09-26
---

Every occupied room needs fresh outside air, and the code sets the minimum by what the room is used for: an amount per person and an amount per square foot of floor. The engineer does that arithmetic. The estimator's job is to read where it landed: a room air schedule that says its supply includes the ventilation means the rooftop units bring the outside air in through their economizers or outside-air dampers, and nothing more is priced. A set that shows a dedicated outdoor-air unit, or outside-air ducts to each unit, is more equipment and more duct.

## What the app does with it

Nothing automatic. Bid Check's OA meets code row is a manual tick you make once you have read the schedule's note or found the outdoor-air equipment. The Room Sizer's airflow by room type is supply air for sizing, not this minimum (see the room airflow rule).

## Verify against your edition

The course cites IMC 403 as a whole and teaches no rate. Many jurisdictions adopt ASHRAE 62.1 alongside or instead of the IMC table, and the rates differ by edition, so the numbers belong to the engineer and the adopted code.

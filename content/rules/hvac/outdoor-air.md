---
id: hvac.ventilation.outdoor-air
title: Outdoor air for ventilation
trade: hvac
kind: code
status: applied
summary: Occupied spaces get a code minimum of outdoor air, set by the kind of room, the people in it and its floor area (a dining room 7.5 CFM a person plus 0.18 a square foot); on a bid the question is whether the plan's supply already carries it or a separate unit does.
values:
  - when: outdoor air to an occupied space, by mechanical or natural ventilation
    value: required
  - when: the minimum, by occupancy
    value: per person plus per floor area
  - when: a dining room, per person
    value: 7.5
    unit: cfm/person
  - when: a dining room, per square foot of floor
    value: 0.18
    unit: cfm/ft²
source:
  code: IMC
  section: 403 Mechanical ventilation (rates in Table 403.3.1.1)
  editions: [2021]
  url: https://codes.iccsafe.org/content/IMC2021P1/chapter-4-ventilation
amendments: []
used_by: [course]
updated: 2026-09-27
---

Every occupied room needs fresh outside air, and the code sets the minimum by what the room is used for: an amount per person and an amount per square foot of floor. A dining room, for one, is 7.5 CFM a person plus 0.18 a square foot, at a default of 70 people per 1,000 square feet. The engineer does that arithmetic. It sets how much of a room's supply must be outside air, not the supply itself: the cooling load sets the supply, and only in a crowded room with a small load does the ventilation push the supply up.

The estimator's job is to read where it landed: an equipment schedule that gives each rooftop unit its outdoor-air CFM, and a room air schedule that says its supply includes the ventilation, mean the rooftop units bring the outside air in through their economizers or outside-air dampers, and nothing more is priced. A set that shows a dedicated outdoor-air unit, or outside-air ducts to each unit, is more equipment and more duct.

## What the app does with it

Nothing automatic. Bid Check's OA meets code row is a manual tick you make once you have read the schedule's outdoor-air number and its note, or found the outdoor-air equipment. The Room Sizer's airflow by room type is supply air for sizing, not this minimum (see the room airflow rule).

## Verify against your edition

The table's rates are ASHRAE 62.1's Ventilation Rate Procedure: the dining room's 7.5 and 0.18 read the same in the Seattle 2021 Mechanical Code (the IMC with Washington amendments) and in an older IMC Table 403.3. Some adoptions allow a design to ASHRAE 62.1 directly instead of the table, and an engineered design may reduce the rate; the rates also move between editions. Local amendments still govern: the numbers belong to the engineer and the adopted code.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.

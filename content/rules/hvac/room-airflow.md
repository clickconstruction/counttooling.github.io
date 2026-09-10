---
id: hvac.room.airflow-defaults
title: Room airflow by type
trade: hvac
kind: convention
status: applied
summary: The cubic feet per minute per square foot the app assumes for a room type when no target is given — office 1.0, conference and break 1.5, storage 0.5.
values:
  - when: office
    value: 1.0
    unit: cfm/ft²
    code: duct-model.js#ROOM_TYPE_CFM_PER_SQFT.office.cfmPerSqFt
  - when: conference
    value: 1.5
    unit: cfm/ft²
    code: duct-model.js#ROOM_TYPE_CFM_PER_SQFT.conference.cfmPerSqFt
  - when: break room
    value: 1.5
    unit: cfm/ft²
    code: duct-model.js#ROOM_TYPE_CFM_PER_SQFT.break.cfmPerSqFt
  - when: storage
    value: 0.5
    unit: cfm/ft²
    code: duct-model.js#ROOM_TYPE_CFM_PER_SQFT.storage.cfmPerSqFt
source:
  code: trade practice
  section: light-commercial supply-air rule of thumb
  editions: []
amendments: []
used_by: [roomSizer, ductSchedule]
updated: 2026-09-09
---

When a Room Sizer room has a type but no airflow, the app needs a starting target to balance a system against. These are the rules of thumb a design-build estimator uses to check a plan before an engineer's schedule exists: about one CFM per square foot for an office, more for a full conference or break room, less for storage.

## What the app does with it

A room's target airflow is its floor area times this rate unless you give the room its own; the air-balance badges compare the diffusers you counted in the room against that target. A room type of custom carries no rate.

## What it does not do

This is supply air for sizing, not outdoor-air ventilation. ASHRAE 62.1 rates are per occupant plus per area and belong to the engineer.

---
id: hvac.damper.fire-damper
title: Fire dampers at rated walls
trade: hvac
kind: code
status: draft
summary: Where a duct passes through a fire-resistance-rated wall, the code wants a listed fire damper at the penetration unless an exception removes it, so each crossing of a rated wall is a damper, an access door and a sleeve on the bid.
values:
  - when: a duct through a fire-resistance-rated wall, a listed fire damper at the penetration, unless an exception of 607.5.2 or 607.5.3 removes it
    value: required
  - when: a grease duct through the same wall (it takes a listed enclosure or wrap instead)
    value: none
source:
  code: IMC
  section: 607.5 Where required (607.5.1 fire walls, 607.5.2 fire barriers, 607.5.3 fire partitions)
  editions: [2018, 2021]
  url: https://codes.iccsafe.org/content/IMC2021P1/chapter-6-duct-systems
amendments: []
used_by: []
updated: 2026-09-27
---

A rated wall holds a fire back for its rating only if the holes through it do too. A duct is a hole, so where one passes through a wall the architect rated, the code wants a listed fire damper in it: a frame with a curtain held open by a fusible link that melts and drops the curtain in a fire. The keynote names which walls are rated and the plan usually tags each damper FD.

Which subsection applies depends on how the architect classified the wall. 607.5.1 is fire walls, with no exceptions. 607.5.2 is fire barriers and 607.5.3 fire partitions, and each carries exceptions. A one-hour interior wall in a restaurant, like the course's kitchen wall, is a fire barrier or a fire partition, not a fire wall. The exceptions that most often remove a damper: a fire barrier or partition rated one hour or less, in a building sprinklered throughout, penetrated by a ducted system of steel continuous to the outlets (607.5.2 exception 3, 607.5.3 exception 4); and a corridor wall in a sprinklered building where the duct is protected as a through penetration (607.5.3 exception 1). The 2021 edition added wording on nonmetallic flex under the ducted-system exception.

On a bid each crossing is more than the damper. It is the damper, an access door beside it so the link can be inspected and replaced, and the sleeve and retaining angles through the wall. Count the penetrations, not just the tags, because a main that crosses the wall above a door is a damper too. Bid what the plan tags: an exception is the engineer's call, made on the drawings.

A grease duct is the exception the other way: nothing goes inside it that could catch grease or close during a fire, so where it passes a rated wall it gets a listed enclosure or wrap for the rating instead (see the grease duct rule).

## What the app does with it

The Counter dialog's Quick tab has a Fire Damper type, so the dampers count like any device. Bid Check's Fire dampers at rated walls row is a manual tick: the app does not know which walls are rated and does not find the penetrations for you.

## Verify against your edition

The numbering is the model IMC's, read from the North Carolina State Fire Marshal's interpretation of the 2018 NC Mechanical Code (which keeps the IMC's numbers) and the 2021 IMC's section titles; IBC 717.5 carries the same list. Local amendments still govern: check your adopted edition's wording for the wall in hand and for each exception, and whether your jurisdiction adds a damper the model code would not.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.

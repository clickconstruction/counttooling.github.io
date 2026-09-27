---
id: hvac.damper.fire-damper
title: Fire dampers at rated walls
trade: hvac
kind: code
status: draft
summary: Where a duct passes through a fire-resistance-rated wall, the code wants a listed fire damper at the penetration, so each crossing of a rated wall is a damper, an access door and a sleeve on the bid.
values:
  - when: a duct through a fire-resistance-rated wall, a listed fire damper at the penetration
    value: required
  - when: a grease duct through the same wall (it takes a listed enclosure or wrap instead)
    value: none
source:
  code: IMC
  section: 607.5.1 Fire dampers where required
  editions: [2021]
  url: https://codes.iccsafe.org/content/IMC2021P1/chapter-6-duct-systems
amendments: []
used_by: []
updated: 2026-09-26
---

A rated wall holds a fire back for its rating only if the holes through it do too. A duct is a hole, so where one passes through a wall the architect rated, the code wants a listed fire damper in it: a frame with a curtain held open by a fusible link that melts and drops the curtain in a fire. The keynote names which walls are rated and the plan usually tags each damper FD.

On a bid each crossing is more than the damper. It is the damper, an access door beside it so the link can be inspected and replaced, and the sleeve and retaining angles through the wall. Count the penetrations, not just the tags, because a main that crosses the wall above a door is a damper too.

A grease duct is the exception: nothing goes inside it that could catch grease or close during a fire, so where it passes a rated wall it gets a listed enclosure or wrap for the rating instead (see the grease duct rule).

## What the app does with it

The Counter dialog's Quick tab has a Fire Damper type, so the dampers count like any device. Bid Check's Fire dampers at rated walls row is a manual tick: the app does not know which walls are rated and does not find the penetrations for you.

## Verify against your edition

The course cites 607.5.1. Check the subsection your adopted edition uses for the wall in hand: the IMC treats fire walls, fire barriers, fire partitions and shaft enclosures separately, and some of those carry exceptions (a ducted system in a sprinklered building, for one) that can remove a damper. Which one a one-hour kitchen wall is depends on how the architect classified it.

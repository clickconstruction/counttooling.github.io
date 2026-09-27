---
id: elec.panel.working-space
title: Working space clearance
trade: electrical
kind: code
status: draft
summary: The clear space the code keeps in front of a panel someone may work on live, as the course teaches it at 120/208 V: 36 in deep, 30 in wide, 6 ft 6 in high.
values:
  - when: depth, clear in front (0 to 150 V to ground, Condition 1)
    value: 36
    unit: in
  - when: width, or the equipment's own width if that is wider
    value: 30
    unit: in
  - when: height, from the floor, or the equipment's own height if that is taller
    value: 6.5
    unit: ft
source:
  code: NEC
  section: 110.26(A)
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: []
updated: 2026-09-26
---

Someone has to stand in front of a live panel to work on it, so the code keeps a box of clear floor in front of it: 36 inches deep on a 120/208 V panel, 30 inches wide (or the width of the panel, if wider), and 6 ft 6 in high. Nothing is stored in it, and nothing is built into it later.

On a bid it matters before the price does. A panel drawn behind an ice machine, in a closet too shallow, or under a shelf is a violation the estimator flags in an RFI, because moving a panel after the walls are up is a change order someone pays for.

## What the app does with it

Nothing yet. The electrical course teaches it on a card (Chapter 1, The panel schedule), after the reader measures the dashed box the engineer drew in front of LP-1. No Bid Check row reads it, and the app does not measure clearances.

## Verify against your edition

The 36 inches is Condition 1 at 0 to 150 V to ground, which is where a 208Y/120 V panel sits. Conditions 2 and 3 (live or grounded parts across the space) and higher voltages ask for more depth, and large equipment adds entrance and egress rules. A tester signs the three figures against the adopted edition before this rule is applied.

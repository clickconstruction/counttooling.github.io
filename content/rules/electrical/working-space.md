---
id: elec.panel.working-space
title: Working space clearance
trade: electrical
kind: code
status: applied
summary: The clear space the code keeps in front of a panel someone may work on live, as the course teaches it at 120/208 V: 36 in deep from the panel's face, 30 in wide, 6 ft 6 in high.
values:
  - when: depth, clear in front of the enclosure (0 to 150 V to ground, any condition)
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
used_by: [course]
updated: 2026-09-27
---

Someone has to stand in front of a live panel to work on it, so the code keeps a box of clear floor in front of it: 36 inches deep on a 120/208 V panel, 30 inches wide (or the width of the panel, if wider), and 6 ft 6 in high. The depth is measured from the front of the enclosure, the panel's face, when its live parts are enclosed, not from the wall behind it. Nothing is stored in the space, and nothing is built into it later.

On a bid it matters before the price does. A panel drawn behind an ice machine, in a closet too shallow, or under a shelf is a violation the estimator flags in an RFI, because moving a panel after the walls are up is a change order someone pays for.

## What the app does with it

The electrical course teaches it on a card (Chapter 1, The panel schedule), after the reader measures the dashed box the engineer drew in front of LP-1, from the panel's face to its outer edge; `check-lesson-rules` holds the card's numbers to this rule. No Bid Check row reads it, and the app does not measure clearances.

## Verify against your edition

At 0 to 150 V to ground all three conditions of Table 110.26(A)(1) are 3 ft, so at 120/208 V the condition (live or grounded parts across the space) does not change the 36 inches. Higher voltages ask for more depth, and large equipment adds entrance and egress rules. The width and height are 110.26(A)(2) and (A)(3). Local amendments still govern.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.

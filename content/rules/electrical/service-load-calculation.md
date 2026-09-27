---
id: elec.service.load-calculation
title: Service and feeder load calculation
trade: electrical
kind: code
status: draft
summary: A service or feeder is sized by the engineer's load calculation under Article 220, never less than the calculated load, and in practice with room for what the owner adds later.
values:
  - when: a service or feeder
    value: rated for at least the load Article 220 calculates
source:
  code: NEC
  section: Article 220
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: []
updated: 2026-09-26
---

How big the service is comes from a calculation, not a guess: the connected load, lighting by the area, receptacles, the kitchen equipment and the motors, with the demand factors the article allows. The service must be rated for at least that. The course's restaurant calculates to about 22 kVA, and its engineer still chose a 200 A service, because nobody sizes a restaurant to today's load.

On a bid the estimator does not redo the calculation; the one-line states its result. The number to read is the main, because it sets the feeder, the ground and the grounding electrode conductor behind it.

## What the app does with it

Nothing yet. The electrical course teaches it on a card (Chapter 7, Read the one-line). The app does not calculate loads; Bid Check's voltage-drop row reads the load you give a circuit, nothing more.

## Verify against your edition

The article's demand factors and its optional methods change between editions, and a local amendment may require a margin. A tester signs the reading against the adopted edition before this rule is applied.

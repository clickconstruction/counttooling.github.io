---
id: elec.service.load-calculation
title: Service and feeder load calculation
trade: electrical
kind: code
status: applied
summary: A service or feeder is sized by the engineer's load calculation under Article 220 (for a new restaurant, the optional method of 220.88), never less than the calculated load, and in practice with room for what the owner adds later.
values:
  - when: a service or feeder
    value: rated for at least the load Article 220 calculates
  - when: a new restaurant, not all electric, 200 kVA or less connected, by the optional method (220.88)
    value: 100
    unit: "% of the connected load"
source:
  code: NEC
  section: Article 220 (220.88 for a new restaurant)
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: [course]
updated: 2026-09-27
---

How big the service is comes from a calculation, not a guess: the connected load, lighting by the area, receptacles, the kitchen equipment and the motors, with the demand factors the article allows. The service must be rated for at least that. For a new restaurant the article offers an optional method (220.88): the connected load with the table's demand factor in place of the standard method. The course's restaurant, not all electric, calculates at 100% of its 22 kVA connected load by that method, 62 A at 208 V three phase, and its engineer still chose a 200 A service, because nobody sizes a restaurant to today's load.

On a bid the estimator does not redo the calculation; the one-line states its result. The number to read is the main, because it sets the feeder, the ground and the grounding electrode conductor behind it.

## What the app does with it

The electrical course teaches it on a card (Chapter 7, Read the one-line), and `check-lesson-rules` holds the card's numbers to this rule. The app does not calculate loads; Bid Check's voltage-drop row reads the load you give a circuit, nothing more.

## Verify against your edition

The article's demand factors and its optional methods change between editions. The 100% for a restaurant that is not all electric at 200 kVA or less is the first row of 220.88's table, read from search-result text (the 2023 section was opened, the table was not); confirm it in your edition. The requirement that a service or feeder carry at least the calculated load sits with the service and feeder articles (230, 215). A local amendment may require a margin, and still governs.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.

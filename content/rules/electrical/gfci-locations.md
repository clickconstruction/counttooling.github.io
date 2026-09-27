---
id: elec.gfci.non-dwelling
title: GFCI protection, non-dwelling
trade: electrical
kind: code
status: applied
summary: Where a commercial building's receptacles must be ground-fault protected, as the course counts them in a restaurant (restrooms, kitchens, food and beverage areas with a sink, within 6 ft of a sink), and the dishwasher's own GFCI.
values:
  - when: bathrooms and restrooms, 210.8(B)(1)
    value: every receptacle
  - when: kitchens, 210.8(B)(2)
    value: every receptacle
  - when: areas with a sink and food or beverage preparation or cooking, 210.8(B)(3) in 2023 (part of (B)(2) in 2020)
    value: every receptacle
  - when: near a sink, from the top inside edge of the bowl, 210.8(B)(7) in 2023 ((B)(5) in 2017 and 2020)
    value: 6
    unit: ft
  - when: a dishwasher, 150 V or less to ground and 60 A or less, 422.5(A)(7), 2020 on
    value: GFCI protection for the appliance
source:
  code: NEC
  section: 210.8(B); 422.5(A)(7) for the dishwasher
  editions: [2017, 2020, 2023]
  url: https://www.nfpa.org/codes-and-standards/nfpa-70-standard-development/70
amendments: []
used_by: [course]
updated: 2026-09-27
---

Outside a dwelling the code still wants people protected where water and receptacles meet. The course counts four of its locations on a restaurant plan: every receptacle in a restroom, every receptacle in a kitchen, the bar's receptacles by its hand sink, and any other receptacle within 6 ft of a sink, like the one beside the mop sink. The bar counts by its sink in every edition, and as a food or beverage area from 2020 on. A receptacle in the dining room or in storage, with no sink near it, stays a plain duplex.

Since the 2020 edition the dishwasher gets GFCI protection too (422.5(A)(7)), whatever the building: on the course's 208 V dishwasher that is a two-pole 30 A GFCI breaker, several times the price of a plain one.

On a bid a GFCI receptacle costs several times a duplex, so the split is money, and a receptacle the engineer drew without the GFI in a room the code protects is an RFI and a GFCI in the bid until the answer comes back.

## What the app does with it

The electrical course teaches it on cards (Chapter 2, The one the engineer missed and Count the rest, where the missed kitchen receptacle is counted once, as a GFCI; Chapter 1, Read a row, for the dishwasher), and `check-lesson-rules` holds the cards' numbers to this rule. The Quick tab offers a GFCI receptacle variant, but the app does not decide which receptacles need one.

## Verify against your edition

The course reads the 2023 edition: (1) bathrooms, (2) kitchens, (3) areas with a sink and food, beverage preparation or cooking, (7) sinks. In 2017 and 2020 sinks are (B)(5); 2020's (B)(2) reads "kitchens or areas with a sink and permanent provisions for food preparation or cooking", and 2017's kitchen needed food preparation and cooking both, so a bar without cooking was caught only by its sink. The list grows with each edition (rooftops, outdoors, damp locations, locker rooms and more), and 2020 widened it to 250 V receptacles. Before 2020 the dishwasher needed no GFCI outside a dwelling. Local amendments still govern.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.

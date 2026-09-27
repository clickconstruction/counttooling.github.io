---
id: hvac.diffuser.neck-velocity
title: Diffuser neck velocity
trade: hvac
kind: convention
status: draft
summary: The trade's rule of thumb keeps air through a supply diffuser's neck between about 400 and 600 feet a minute, so a diffuser carrying more air gets a bigger neck, and the neck size is the flex and tap size on the bid.
values:
  - when: neck velocity, the low end of the band
    value: 400
    unit: fpm
  - when: neck velocity, the high end of the band
    value: 600
    unit: fpm
  - when: 150 CFM through an 8 in neck (the neck-size suggestion's first row)
    value: 430
    unit: fpm
source:
  code: trade practice
  section: diffuser selection rule of thumb (noise), not a code figure
  editions: []
amendments: []
used_by: []
updated: 2026-09-26
---

What sets a diffuser's neck is velocity. Air moving through the neck makes noise, and the faster it moves the louder it gets, so a designer picks the neck so the air goes through at roughly 400 to 600 feet a minute. At 150 CFM an 8 in neck runs about 430 fpm, comfortably inside. A diffuser that carries more air steps up a neck size to stay in the band.

It matters on a bid because the neck size is the flex size and the tap size: the diffuser schedule's necks price every branch.

## What the app does with it

The app does not read this band. A counter with a CFM suggests a neck from a CFM-to-neck table in duct-model.js (`NECK_SIZE_TABLE`: up to 150 CFM on 8 in, 300 on 10 in, 450 on 12 in, 700 on 14 in), and the flex that feeds it follows the neck. Those rows land near the band but not all inside it: the top of each row works out to about 430, 550, 573 and 655 fpm, so the 14 in row sits above 600. Because the band is not a number the app keeps, this rule has no code pointer and stays a draft; the table, not the band, is what a change would edit.

## Verify against your edition

This is design practice, not code, and the band itself is open. The HVAC course's trade read (punch list HC-TRADE) found the card's own example sits inside it (200 CFM through an 8 in neck is about 573 fpm) while the 10 in neck the plan uses runs about 367, below it, and asks whether the trade quotes a lower band such as 300 to 500. A person with the trade settles the band before this rule is applied.

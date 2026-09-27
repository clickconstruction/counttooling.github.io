---
id: hvac.diffuser.neck-velocity
title: Diffuser neck velocity
trade: hvac
kind: convention
status: applied
summary: A diffuser's neck is picked from the maker's sound and throw data and the push its flex needs; makers keep neck velocity under about 1,000 feet a minute, and the app's own neck suggestion puts up to 150 CFM on an 8 in neck and up to 300 on a 10 in, so the neck size is the flex and tap size on the bid.
values:
  - when: a common ceiling for air through a supply diffuser's neck (makers' selection guidance)
    value: 1000
    unit: fpm
  - when: 150 CFM through an 8 in neck (the neck-size suggestion's first row)
    value: 430
    unit: fpm
  - when: the most air the app's neck suggestion puts on an 8 in neck
    value: 150
    unit: CFM per neck
    code: duct-model.js#NECK_SIZE_TABLE[0].maxCfm
  - when: the most air the app's neck suggestion puts on a 10 in neck
    value: 300
    unit: CFM per neck
    code: duct-model.js#NECK_SIZE_TABLE[1].maxCfm
source:
  code: trade practice
  section: diffuser selection from the maker's catalogued sound (NC) and throw data, not a code figure
  editions: []
amendments: []
used_by: [course]
updated: 2026-09-27
---

What sets a diffuser's neck is the maker's selection data, read by the engineer: the sound the diffuser makes at its air (its NC rating), its throw (how far the air carries across the room), and the pressure the runout and its flex take to deliver that air. Diffuser makers' guidance keeps neck velocity below about 1,000 feet a minute; inside that, the catalog decides. At 150 CFM an 8 in neck runs about 430 fpm, and at 200 CFM about 573, both quiet selections. A diffuser that carries more air often steps up a neck size anyway, because a bigger flex costs the fan less push.

It matters on a bid because the neck size is the flex size and the tap size: the diffuser schedule's necks price every branch. The flex is run at the size of the neck it feeds.

## What the app does with it

The app does not read a velocity band. A counter with a CFM suggests a neck from a CFM-to-neck table in duct-model.js (`NECK_SIZE_TABLE`: up to 150 CFM on 8 in, 300 on 10 in, 450 on 12 in, 700 on 14 in), shown on the counter's details and its sidebar hover. The top of each row works out to about 430, 550, 573 and 655 fpm, all well under the makers' ceiling. The first two rows are pinned here, so a change to the table changes this rule in the same commit. On an engineered set the schedule's neck wins over the suggestion.

## Verify against your edition

This is design practice, not code. The earlier draft quoted a 400 to 600 fpm band and said an 8 in neck at 200 CFM would whistle; no public source for that band was found, and the makers' published figure is a ceiling of about 1,000 fpm with selection from their sound and throw tables (Nailor, "How ceiling diffusers are selected", 2022; Sheet Metal Journal repeats the figure). Your shop may carry a tighter number for quiet rooms; the maker's catalog for the diffuser in hand still governs.

Settled 2026-09-27 by Claude on the owner's delegation, from the dossier's research and the model code text; not checked against a printed book or a local amendment.
